namespace slskd.Tests.Unit.Transfers.Downloads;

using System;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using slskd.Transfers;
using slskd.Transfers.Downloads;
using Soulseek;
using Xunit;
using Transfer = slskd.Transfers.Transfer;

public class FindPreviousBatchIdsTests : IDisposable
{
    private readonly SqliteConnection connection;
    private readonly DbContextOptions<TransfersDbContext> options;

    public FindPreviousBatchIdsTests()
    {
        // an in-memory database lives as long as its connection
        connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();

        options = new DbContextOptionsBuilder<TransfersDbContext>().UseSqlite(connection).Options;

        using var context = new TransfersDbContext(options);
        context.Database.EnsureCreated();
    }

    public void Dispose() => connection.Dispose();

    [Fact]
    public void Finds_The_Batch_Of_A_Failed_Download()
    {
        var batch = AddBatch();
        AddTransfer("a.flac", batch, TransferStates.Completed | TransferStates.Errored);

        using var context = new TransfersDbContext(options);
        var found = DownloadService.FindPreviousBatchIds(context, "user", ["a.flac", "b.flac"]);

        Assert.Equal(batch, Assert.Contains("a.flac", found));
        Assert.DoesNotContain("b.flac", found);
    }

    [Fact]
    public void Prefers_The_Latest_Failed_Attempt()
    {
        var older = AddBatch();
        var newer = AddBatch();
        AddTransfer("a.flac", older, TransferStates.Completed | TransferStates.Cancelled, DateTime.UtcNow.AddHours(-2));
        AddTransfer("a.flac", newer, TransferStates.Completed | TransferStates.Errored, DateTime.UtcNow.AddHours(-1));

        using var context = new TransfersDbContext(options);

        Assert.Equal(newer, DownloadService.FindPreviousBatchIds(context, "user", ["a.flac"])["a.flac"]);
    }

    [Fact]
    public void Ignores_Succeeded_Downloads_Other_Users_And_Transfers_Without_A_Batch()
    {
        var batch = AddBatch();
        AddTransfer("done.flac", batch, TransferStates.Completed | TransferStates.Succeeded);
        AddTransfer("theirs.flac", batch, TransferStates.Completed | TransferStates.Errored, username: "someone else");
        AddTransfer("loose.flac", batchId: null, TransferStates.Completed | TransferStates.Errored);

        using var context = new TransfersDbContext(options);

        Assert.Empty(DownloadService.FindPreviousBatchIds(context, "user", ["done.flac", "theirs.flac", "loose.flac"]));
    }

    private Guid AddBatch()
    {
        using var context = new TransfersDbContext(options);
        var batch = new Batch { Id = Guid.NewGuid(), Username = "user" };
        context.Batches.Add(batch);
        context.SaveChanges();
        return batch.Id;
    }

    private void AddTransfer(string filename, Guid? batchId, TransferStates state, DateTime? requestedAt = null, string username = "user")
    {
        using var context = new TransfersDbContext(options);
        context.Transfers.Add(new Transfer
        {
            Id = Guid.NewGuid(),
            BatchId = batchId,
            Username = username,
            Direction = TransferDirection.Download,
            Filename = filename,
            State = state,
            RequestedAt = requestedAt ?? DateTime.UtcNow,
        });
        context.SaveChanges();
    }
}
