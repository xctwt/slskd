// <copyright file="CountryDatabase.cs" company="JP Dillingham">
//           ▄▄▄▄     ▄▄▄▄     ▄▄▄▄
//     ▄▄▄▄▄▄█  █▄▄▄▄▄█  █▄▄▄▄▄█  █
//     █__ --█  █__ --█    ◄█  -  █
//     █▄▄▄▄▄█▄▄█▄▄▄▄▄█▄▄█▄▄█▄▄▄▄▄█
//   ┍━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ━━━━ ━  ━┉   ┉     ┉
//   │ Copyright (c) JP Dillingham.
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
//   │ https://slskd.org
//   │
//   ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ ╌ ╌╌╌╌ ╌
//   │ SPDX-FileCopyrightText: JP Dillingham
//   │ SPDX-License-Identifier: AGPL-3.0-only
//   ╰───────────────────────────────────────────╶──── ─ ─── ─  ── ──┈  ┈
// </copyright>

namespace slskd.Integrations.GeoIP
{
    using System;
    using System.Collections.Generic;
    using System.IO;
    using System.Net;
    using System.Net.Sockets;

    /// <summary>
    ///     Maps IPv4 addresses to the countries they're registered in.
    /// </summary>
    public sealed class CountryDatabase
    {
        private CountryDatabase(uint[] starts, uint[] ends, string[] codes)
        {
            Starts = starts;
            Ends = ends;
            Codes = codes;
        }

        /// <summary>
        ///     Gets the number of address ranges in the database.
        /// </summary>
        public int Count => Starts.Length;

        private string[] Codes { get; }
        private uint[] Ends { get; }
        private uint[] Starts { get; }

        /// <summary>
        ///     Reads a database in DB-IP's CSV format: one <c>first,last,country</c> range per line, in ascending order.
        /// </summary>
        /// <remarks>IPv6 ranges are skipped; Soulseek peers only have IPv4 addresses.</remarks>
        /// <param name="reader">The CSV to read.</param>
        /// <returns>The database.</returns>
        /// <exception cref="InvalidDataException">Thrown when the CSV is out of order or holds no IPv4 ranges.</exception>
        public static CountryDatabase Parse(TextReader reader)
        {
            var starts = new List<uint>();
            var ends = new List<uint>();
            var codes = new List<string>();

            // the same few hundred codes repeat across hundreds of thousands of ranges
            var interned = new Dictionary<string, string>(StringComparer.Ordinal);

            string line;

            while ((line = reader.ReadLine()) != null)
            {
                var fields = line.Split(',');

                if (fields.Length < 3
                    || !TryParseIPv4(fields[0], out var start)
                    || !TryParseIPv4(fields[1], out var end)
                    || end < start)
                {
                    continue;
                }

                if (starts.Count > 0 && start <= ends[^1])
                {
                    throw new InvalidDataException($"Range {fields[0]}-{fields[1]} overlaps or precedes the one before it");
                }

                var code = fields[2].Trim().ToUpperInvariant();

                // ZZ marks reserved and unassigned space, such as private networks
                if (code.Length != 2 || code == "ZZ")
                {
                    continue;
                }

                if (!interned.TryGetValue(code, out var shared))
                {
                    interned[code] = shared = code;
                }

                // neighbouring ranges in the same country are one range as far as a lookup is concerned
                if (starts.Count > 0 && ends[^1] == start - 1 && ReferenceEquals(codes[^1], shared))
                {
                    ends[^1] = end;
                    continue;
                }

                starts.Add(start);
                ends.Add(end);
                codes.Add(shared);
            }

            if (starts.Count == 0)
            {
                throw new InvalidDataException("No IPv4 ranges found");
            }

            return new CountryDatabase(starts.ToArray(), ends.ToArray(), codes.ToArray());
        }

        /// <summary>
        ///     Gets the ISO 3166-1 alpha-2 code of the country the specified <paramref name="address"/> is registered in.
        /// </summary>
        /// <param name="address">The address.</param>
        /// <returns>The uppercase country code, or null if the address isn't IPv4 or isn't in any country.</returns>
        public string Lookup(IPAddress address)
        {
            if (address == null)
            {
                return null;
            }

            if (address.IsIPv4MappedToIPv6)
            {
                address = address.MapToIPv4();
            }

            if (address.AddressFamily != AddressFamily.InterNetwork)
            {
                return null;
            }

            var value = ToUInt32(address);

            // the last range starting at or before the address is the only one that can hold it
            var index = Array.BinarySearch(Starts, value);

            if (index < 0)
            {
                index = ~index - 1;
            }

            return index >= 0 && value <= Ends[index] ? Codes[index] : null;
        }

        private static bool TryParseIPv4(string text, out uint value)
        {
            value = 0;

            if (text.Contains(':', StringComparison.Ordinal)
                || !IPAddress.TryParse(text, out var address)
                || address.AddressFamily != AddressFamily.InterNetwork)
            {
                return false;
            }

            value = ToUInt32(address);
            return true;
        }

        private static uint ToUInt32(IPAddress address)
        {
            var bytes = address.GetAddressBytes();
            return ((uint)bytes[0] << 24) | ((uint)bytes[1] << 16) | ((uint)bytes[2] << 8) | bytes[3];
        }
    }
}
