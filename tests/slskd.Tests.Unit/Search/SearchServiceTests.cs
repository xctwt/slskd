namespace slskd.Tests.Unit.Search
{
    using System.Collections.Generic;
    using Moq;
    using slskd.Search;
    using Soulseek;
    using Xunit;

    public class SearchServiceTests
    {
        [Theory]
        [InlineData("kendrick lamar damn", "kendrick lamar")]
        [InlineData("KENDRICK LAMAR - DAMN.", "kendrick lamar")]
        [InlineData("joji in tongues", null)]
        [InlineData("", null)]
        [InlineData(null, null)]
        public void FindExcludedPhrase_Matches_Anywhere_Ignoring_Case(string searchText, string expected)
        {
            var client = new Mock<ISoulseekClient>();
            var service = new SearchService(searchHub: null, optionsMonitor: null, client.Object, contextFactory: null);

            client.Raise(c => c.ExcludedSearchPhrasesReceived += null, client.Object, new List<string> { "kendrick lamar", " " });

            Assert.Equal(expected, service.FindExcludedPhrase(searchText));
        }

        [Fact]
        public void FindExcludedPhrase_Returns_Null_Before_The_Server_Sends_The_List()
        {
            var service = new SearchService(searchHub: null, optionsMonitor: null, new Mock<ISoulseekClient>().Object, contextFactory: null);

            Assert.Null(service.FindExcludedPhrase("kendrick lamar damn"));
        }
    }
}
