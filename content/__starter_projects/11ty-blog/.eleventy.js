const { DateTime } = require("luxon");

/**
 * This is the JavaScript code that sets the config for your Eleventy site
 * You can add customizations here to define how the site builds your content
 */

module.exports = function (eleventyConfig) {
  eleventyConfig.setTemplateFormats([
    "html",
    "njk",
    "md",
    "css",
    "jpeg",
    "jpg",
    "png",
    "svg",
  ]);

  eleventyConfig.setBrowserSyncConfig({ ghostMode: false });
  eleventyConfig.addFilter("htmlDateString", (dateObj) =>
    DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("dd LLL yyyy")
  );

  // Build the collection of posts to list in the site
  eleventyConfig.addCollection("posts", function (collection) {

    const coll = collection
      .getFilteredByTag("posts")
      .sort((a, b) => b.data.date - a.data.date);

    for (let i = 0; i < coll.length; i++) {
      const prevPost = coll[i + 1];
      const nextPost = coll[i - 1];

      coll[i].data["prevPost"] = prevPost;
      coll[i].data["nextPost"] = nextPost;
    }

    return coll;
  });

  return {
    dir: {
      includes: "_layouts"
    },
  };
};