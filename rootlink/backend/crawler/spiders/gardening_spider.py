import scrapy
from bs4 import BeautifulSoup


class GardeningSpider(scrapy.Spider):
    name = "gardening"
    allowed_domains = [
        "permaculturenews.org",
        "gardenersworld.com",
        "nurserymag.com",
    ]
    start_urls = [
        "https://permaculturenews.org/",
        "https://www.gardenersworld.com/",
        "https://nurserymag.com/",
    ]

    def parse(self, response):
        soup = BeautifulSoup(response.text, "lxml")
        title = soup.find("h1")
        title_text = title.get_text(strip=True) if title else response.url

        paragraphs = soup.find_all("p")
        text = " ".join(p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True))

        if len(text) > 100:
            yield {
                "url": response.url,
                "title": title_text,
                "text": text[:10000],
                "category": "gardening",
                "content_type": "article",
            }

        for link in soup.find_all("a", href=True):
            href = link["href"]
            if href.startswith("/"):
                href = response.urljoin(href)
            if any(domain in href for domain in self.allowed_domains):
                yield scrapy.Request(href, callback=self.parse)
