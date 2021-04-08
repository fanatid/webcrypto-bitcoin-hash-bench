const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
  target: "web",
  mode: "production",
  entry: "./index.js",
  output: {
    path: __dirname,
    filename: "browser.js",
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"],
      process: "process/browser.js",
    }),
  ],
  optimization: {
    minimizer: [new TerserPlugin({ extractComments: false })],
  },
  resolve: {
    fallback: {
      crypto: require.resolve("crypto-browserify"),
      stream: require.resolve("stream-browserify"),
    },
  },
};
