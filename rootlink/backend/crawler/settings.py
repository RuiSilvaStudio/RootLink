BOT_NAME = "rootlink_crawler"

SPIDER_MODULES = ["crawler.spiders"]
NEWSPIDER_MODULE = "crawler.spiders"

ROBOTSTXT_OBEY = True
CONCURRENT_REQUESTS = 8
DOWNLOAD_DELAY = 1.0
COOKIES_ENABLED = False

ITEM_PIPELINES = {
    "crawler.pipelines.ContentPipeline": 300,
}
