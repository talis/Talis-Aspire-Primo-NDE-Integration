const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
const mf = require("@angular-architects/module-federation/webpack");
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require("path");
const webpack = require("webpack");
const share = mf.share;

const sharedMappings = new mf.SharedMappings();
sharedMappings.register(
  path.join(__dirname, 'tsconfig.json'),
  [/* mapped paths to share */]);

module.exports = {
  context: path.resolve(__dirname), // Sets the context to the directory where webpack.config.js is
  output: {
    uniqueName: "TalisAspireIntegration",
    publicPath: "auto",
  },
  optimization: {
    minimize: true,
    runtimeChunk: false,
  },
  resolve: {
    alias: {
      ...sharedMappings.getAliases(),
    },
  },
  experiments: {
    outputModule: true,
  },
  module: {
    rules: [
      // ... other rules ...
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: "asset/resource",
      },
    ],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "src/assets",
          to: "assets",
          noErrorOnMissing: true,
          globOptions: {
            ignore: [
              "**/.gitkeep", // Make sure this matches exactly the files you want to exclude
              "**/.*", // This pattern excludes all hidden files
            ],
          },
        }, // Adjust the paths as needed
      ],
    }),
    // DISABLE ngDevMode as it is not needed in a remoteEntry work around for issue: https://github.com/angular-architects/module-federation-plugin/issues/458
    // new webpack.DefinePlugin({
    //   ngDevMode: "undefined",
    // }),
    // END DISABLE ngDevMode as it is not needed in a remoteEntry
    new ModuleFederationPlugin({
      library: { type: "module" },

      // For remotes (please adjust)
      name: "TalisAspireIntegration",
      filename: "remoteEntry.js",
      // NOTE: The exposed key MUST match the add-on name (ADDON_NAME in
      // build-settings.env) because Primo NDE resolves the remote by add-on
      // name. prebuild.js keeps this key in sync with ADDON_NAME at build time.
      exposes: {
        "./TalisAspireIntegration": "./src/bootstrapTalisAspireIntegration.ts",
      },

      // For hosts (please adjust)
      // remotes: {
      //     "mfe1": "http://localhost:3000/remoteEntry.js",

      // },

      shared: share({
        "@angular/core": { requiredVersion: "auto" },
        "@angular/common": { requiredVersion: "auto" },
        "@angular/router": { requiredVersion: "auto" },
        rxjs: { requiredVersion: "auto" },
        "@angular/common/http": { requiredVersion: "auto" },
        "@angular/platform-browser": { requiredVersion: "auto" },
        "@ngx-translate/core": { singleton: true },
        "@ngrx/store": { singleton: true },
        ...sharedMappings.getDescriptors(),
      }),
    }),
    sharedMappings.getPlugin(),
  ],
};
