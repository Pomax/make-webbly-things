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
  eleventyConfig.addCollection("posts", (collection) =>
    collection
      .getFilteredByTag("posts")
      .sort((a, b) => b.data.date - a.data.date)
      .map((post, i, posts) => {
        Object.assign(post.data, {
          // wrap around postage!  
          prevPost: posts.at(i - 1),
          nextPost: posts.at((i + 1) % posts.length)
        });
        return post;
      })
  );

  return {
    dir: {
      includes: "_layouts"
    },
  };
};