// <copyright file="CountryService.cs" company="xctwt">
//           ▄▄▄▄     ▄▄▄▄     ▄▄▄▄
//     ▄▄▄▄▄▄█  █▄▄▄▄▄█  █▄▄▄▄▄█  █
//     █__ --█  █__ --█    ◄█  -  █
//     █▄▄▄▄▄█▄▄█▄▄▄▄▄█▄▄█▄▄█▄▄▄▄▄█
//   ┍━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ━━━━ ━  ━┉   ┉     ┉
//   │ Copyright (c) 2026 xctwt.
//   │
//   │ This program is free software: you can redistribute it and/or modify
//   │ it under the terms of the GNU Affero General Public License as published
//   │ by the Free Software Foundation, version 3.
//   │
//   │ This program is distributed in the hope that it will be useful,
//   │ but WITHOUT ANY WARRANTY; without even the implied warranty of
//   │ MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//   │ GNU Affero General Public License for more details.
//   │
//   │ You should have received a copy of the GNU Affero General Public License
//   │ along with this program.  If not, see https://www.gnu.org/licenses/.
//   │
//   │ This program is distributed with Additional Terms pursuant to Section 7
//   │ of the AGPLv3.  See the LICENSE file in the root directory of this
//   │ project for the complete terms and conditions.
//   │
//   │ https://github.com/xctwt/webseekd
//   │
//   ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ ╌ ╌╌╌╌ ╌
//   │ SPDX-FileCopyrightText: 2026 xctwt
//   │ SPDX-License-Identifier: AGPL-3.0-only
//   ╰───────────────────────────────────────────╶──── ─ ─── ─  ── ──┈  ┈
// </copyright>

namespace slskd.Integrations.GeoIP
{
    using System;
    using System.IO;
    using System.IO.Compression;
    using System.Net;
    using System.Net.Http;
    using System.Net.Http.Headers;
    using System.Threading;
    using System.Threading.Tasks;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;

    /// <summary>
    ///     Finds the countries IP addresses are registered in.
    /// </summary>
    public interface ICountryService
    {
        /// <summary>
        ///     Gets the ISO 3166-1 alpha-2 code of the country the specified <paramref name="address"/> is registered in.
        /// </summary>
        /// <param name="address">The address.</param>
        /// <param name="cancellationToken">The token to monitor for cancellation requests.</param>
        /// <returns>The operation context, including the uppercase country code, or null if it isn't known.</returns>
        Task<string> GetCountryCodeAsync(IPAddress address, CancellationToken cancellationToken = default);
    }

    /// <summary>
    ///     Finds countries in DB-IP's free IP to Country Lite database, which is downloaded to the data directory on first
    ///     use and again each month, when DB-IP publishes a new one. Lookups never leave this machine.
    /// </summary>
    /// <remarks>The database is licensed under CC BY 4.0: https://db-ip.com.</remarks>
    public sealed class CountryService : ICountryService, IDisposable
    {
        private const long MaximumDownloadBytes = 64 * 1024 * 1024;

        private static readonly TimeSpan DownloadTimeout = TimeSpan.FromMinutes(2);
        private static readonly TimeSpan MaximumAge = TimeSpan.FromDays(32);
        private static readonly TimeSpan RetryDelay = TimeSpan.FromHours(1);

        /// <summary>
        ///     Initializes a new instance of the <see cref="CountryService"/> class.
        /// </summary>
        /// <param name="httpClientFactory">The HTTP client factory.</param>
        /// <param name="optionsMonitor">The options monitor.</param>
        /// <param name="log">The logger.</param>
        public CountryService(
            IHttpClientFactory httpClientFactory,
            IOptionsMonitor<slskd.Options> optionsMonitor,
            ILogger<CountryService> log)
        {
            HttpClientFactory = httpClientFactory;
            OptionsMonitor = optionsMonitor;
            Log = log;
        }

        private static string DatabaseFile => Path.Combine(Program.DataDirectory, "geoip", "dbip-country-lite.csv.gz");

        private CountryDatabase Database { get; set; }
        private DateTime DatabaseDate { get; set; }
        private IHttpClientFactory HttpClientFactory { get; }
        private SemaphoreSlim Lock { get; } = new SemaphoreSlim(1, 1);
        private ILogger<CountryService> Log { get; }
        private IOptionsMonitor<slskd.Options> OptionsMonitor { get; }
        private DateTime RetryAfter { get; set; } = DateTime.MinValue;

        /// <inheritdoc/>
        public async Task<string> GetCountryCodeAsync(IPAddress address, CancellationToken cancellationToken = default)
        {
            if (OptionsMonitor.CurrentValue.Integrations.GeoIP.Disabled || address == null)
            {
                return null;
            }

            var database = Database;

            if (database is null)
            {
                database = await LoadAsync(cancellationToken);
            }
            else if (IsStale(DatabaseDate) && DateTime.UtcNow >= RetryAfter && Lock.CurrentCount > 0)
            {
                // keep answering from the old database while the new one downloads
                _ = Task.Run(() => LoadAsync(CancellationToken.None), CancellationToken.None);
            }

            return database?.Lookup(address);
        }

        /// <inheritdoc/>
        public void Dispose()
        {
            Lock.Dispose();
        }

        private static bool IsStale(DateTime date) => DateTime.UtcNow - date > MaximumAge;

        private static CountryDatabase Read(string file)
        {
            using var stream = File.OpenRead(file);
            using var gzip = new GZipStream(stream, CompressionMode.Decompress);
            using var reader = new StreamReader(gzip);
            return CountryDatabase.Parse(reader);
        }

        private async Task<CountryDatabase> LoadAsync(CancellationToken cancellationToken)
        {
            await Lock.WaitAsync(cancellationToken);

            try
            {
                if (Database is null && File.Exists(DatabaseFile))
                {
                    try
                    {
                        Database = Read(DatabaseFile);
                        DatabaseDate = File.GetLastWriteTimeUtc(DatabaseFile);
                        Log.LogDebug("Loaded {Count} country ranges from {File}", Database.Count, DatabaseFile);
                    }
                    catch (Exception ex) when (ex is IOException or InvalidDataException)
                    {
                        Log.LogWarning("Failed to read the country database {File}: {Message}", DatabaseFile, ex.Message);
                    }
                }

                if ((Database is null || IsStale(DatabaseDate)) && DateTime.UtcNow >= RetryAfter)
                {
                    try
                    {
                        Database = await DownloadAsync(cancellationToken);
                        DatabaseDate = DateTime.UtcNow;
                    }
                    catch (Exception ex) when (ex is HttpRequestException or IOException or InvalidDataException or TimeoutException)
                    {
                        RetryAfter = DateTime.UtcNow + RetryDelay;
                        Log.LogWarning("Failed to download the country database from DB-IP, retrying in {Delay}: {Message}", RetryDelay, ex.Message);
                    }
                }

                return Database;
            }
            finally
            {
                Lock.Release();
            }
        }

        private async Task<CountryDatabase> DownloadAsync(CancellationToken cancellationToken)
        {
            // each month's database appears early in the month; until it does, last month's is the latest
            var now = DateTime.UtcNow;
            var temporaryFile = DatabaseFile + ".download";

            Directory.CreateDirectory(Path.GetDirectoryName(DatabaseFile));

            foreach (var month in new[] { now, now.AddMonths(-1) })
            {
                var uri = new Uri($"https://download.db-ip.com/free/dbip-country-lite-{month:yyyy-MM}.csv.gz");

                using var timeoutSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                timeoutSource.CancelAfter(DownloadTimeout);

                using var request = new HttpRequestMessage(HttpMethod.Get, uri);
                request.Headers.UserAgent.Add(new ProductInfoHeaderValue(Program.DisplayName, Program.SemanticVersion));
                request.Headers.UserAgent.Add(new ProductInfoHeaderValue($"(+{Program.RepositoryUrl})"));

                try
                {
                    using var response = await HttpClientFactory.CreateClient()
                        .SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeoutSource.Token);

                    if (response.StatusCode == HttpStatusCode.NotFound)
                    {
                        continue;
                    }

                    response.EnsureSuccessStatusCode();

                    if (response.Content.Headers.ContentLength > MaximumDownloadBytes)
                    {
                        throw new InvalidDataException($"{uri} is larger than {MaximumDownloadBytes} bytes");
                    }

                    await using (var source = await response.Content.ReadAsStreamAsync(timeoutSource.Token))
                    await using (var destination = File.Create(temporaryFile))
                    {
                        await source.CopyToAsync(destination, timeoutSource.Token);
                    }

                    // make sure the download is usable before replacing a database that works
                    var database = Read(temporaryFile);
                    File.Move(temporaryFile, DatabaseFile, overwrite: true);

                    Log.LogInformation("Downloaded the {Month:yyyy-MM} country database from DB-IP ({Count} ranges)", month, database.Count);
                    return database;
                }
                catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
                {
                    throw new TimeoutException($"{uri.Host} did not respond within {DownloadTimeout.TotalSeconds} seconds");
                }
                finally
                {
                    if (File.Exists(temporaryFile))
                    {
                        File.Delete(temporaryFile);
                    }
                }
            }

            throw new InvalidDataException("DB-IP has no country database for this month or last month");
        }
    }
}
