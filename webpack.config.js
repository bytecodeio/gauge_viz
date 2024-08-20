let path = require("path");


let webpackConfig = {
  entry: {
    gauge: "./src/visualizations/gauge.ts",
  },
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "dist"),
    library: "[name]",
    libraryTarget: "umd",
  },
  resolve: {
    extensions: [".ts", ".js", ".scss", ".css"],
  },
 module: {
    rules: [
      { test: /\.ts$/, loader: "ts-loader" },
      { test: /\.css$/, loader: ["to-string-loader", "css-loader"] },
    ],
  },
  devServer: {
    contentBase: false,
    compress: true,
    port: 3443,
    https: true,
  },
  devtool: "eval",
  watch: true,
};

module.exports = 
  webpackConfig
;
