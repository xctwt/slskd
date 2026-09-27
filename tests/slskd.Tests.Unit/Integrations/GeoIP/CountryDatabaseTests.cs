namespace slskd.Tests.Unit.Integrations.GeoIP
{
    using System.IO;
    using System.Net;
    using slskd.Integrations.GeoIP;
    using Xunit;

    public class CountryDatabaseTests
    {
        private const string Csv = """
            0.0.0.0,0.255.255.255,ZZ
            1.0.0.0,1.0.0.255,AU
            1.0.1.0,1.0.3.255,CN
            1.0.4.0,1.0.7.255,CN
            5.0.0.0,5.0.0.255,de
            10.0.0.0,10.255.255.255,ZZ
            2001:200::,2001:200:ffff:ffff:ffff:ffff:ffff:ffff,JP
            """;

        [Theory]
        [InlineData("1.0.0.0", "AU")]
        [InlineData("1.0.0.255", "AU")]
        [InlineData("1.0.2.3", "CN")]
        [InlineData("1.0.7.255", "CN")]
        [InlineData("5.0.0.128", "DE")]
        public void Lookup_Finds_Country(string address, string expected)
        {
            var database = CountryDatabase.Parse(new StringReader(Csv));

            Assert.Equal(expected, database.Lookup(IPAddress.Parse(address)));
        }

        [Theory]
        [InlineData("0.0.0.1")]
        [InlineData("1.0.8.0")]
        [InlineData("4.255.255.255")]
        [InlineData("10.1.2.3")]
        [InlineData("255.255.255.255")]
        [InlineData("2001:200::1")]
        public void Lookup_Returns_Null_When_Not_In_A_Country(string address)
        {
            var database = CountryDatabase.Parse(new StringReader(Csv));

            Assert.Null(database.Lookup(IPAddress.Parse(address)));
        }

        [Fact]
        public void Lookup_Maps_IPv4_Mapped_IPv6()
        {
            var database = CountryDatabase.Parse(new StringReader(Csv));

            Assert.Equal("AU", database.Lookup(IPAddress.Parse("1.0.0.1").MapToIPv6()));
        }

        [Fact]
        public void Parse_Merges_Adjacent_Ranges_In_The_Same_Country()
        {
            var database = CountryDatabase.Parse(new StringReader(Csv));

            // AU, CN (two adjacent ranges) and DE; ZZ and IPv6 are skipped
            Assert.Equal(3, database.Count);
        }

        [Fact]
        public void Parse_Throws_When_Out_Of_Order()
        {
            var csv = "5.0.0.0,5.0.0.255,DE\n1.0.0.0,1.0.0.255,AU";

            Assert.Throws<InvalidDataException>(() => CountryDatabase.Parse(new StringReader(csv)));
        }

        [Fact]
        public void Parse_Throws_When_Empty()
        {
            Assert.Throws<InvalidDataException>(() => CountryDatabase.Parse(new StringReader("<html>not found</html>")));
        }
    }
}
