import { extractCrawlerLinks, isPrivateAddress } from "./url-crawler.service";

describe("URL crawler safeguards", () => {
  it("rejects private and special-use network addresses", () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("10.1.2.3")).toBe(true);
    expect(isPrivateAddress("172.20.1.2")).toBe(true);
    expect(isPrivateAddress("192.168.1.2")).toBe(true);
    expect(isPrivateAddress("169.254.1.1")).toBe(true);
    expect(isPrivateAddress("::1")).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("2606:4700:4700::1111")).toBe(false);
  });

  it("extracts only same-origin HTTPS page and sitemap links", () => {
    const page = new URL("https://docs.example.com/start");
    const html = `
      <a href="/guide#intro">Guide</a>
      <a href="https://other.example.com/private">Other</a>
      <a href="http://docs.example.com/insecure">Insecure</a>
      <loc>https://docs.example.com/reference</loc>
    `;
    expect(extractCrawlerLinks(html, page)).toEqual([
      "https://docs.example.com/guide",
      "https://docs.example.com/reference",
    ]);
  });
});
