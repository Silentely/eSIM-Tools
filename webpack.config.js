const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const { GenerateSW } = require('workbox-webpack-plugin');
const { sentryWebpackPlugin } = require('@sentry/webpack-plugin');

// Sentry 配置（仅生产环境且配置完整时启用）
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;
const isSentryEnabled = sentryAuthToken && sentryOrg && sentryProject && process.env.NODE_ENV === 'production';

module.exports = {
  entry: {
    main: './src/js/main.js',
    giffgaff: './src/js/giffgaff.js',
    simyo: './src/js/simyo.js',
    footer: './src/js/bootstrap-footer.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'js/[name].[contenthash].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          'postcss-loader'
        ]
      }
    ]
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.info', 'console.debug'], // Remove specific console methods
            passes: 2 // Run compression twice for better results
          },
          mangle: {
            safari10: true // Fix Safari 10 loop iterator bug
          }
        },
        parallel: true,
        extractComments: false // Don't create separate license files
      })
    ],
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 5,
      maxAsyncRequests: 5,
      minSize: 10000, // 10KB minimum
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
          reuseExistingChunk: true
        },
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
          name: 'common'
        }
      }
    },
    runtimeChunk: {
      name: 'runtime' // Extract webpack runtime for better caching
    },
    moduleIds: 'deterministic', // Stable module IDs for better long-term caching
    chunkIds: 'deterministic'
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.ACCESS_KEY': JSON.stringify(process.env.ACCESS_KEY || ''),
      'process.env.TURNSTILE_SITE_KEY': JSON.stringify(process.env.TURNSTILE_SITE_KEY || ''),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
      'process.env.SENTRY_DSN': JSON.stringify(process.env.SENTRY_DSN || ''),
      'process.env.SENTRY_ENVIRONMENT': JSON.stringify(process.env.SENTRY_ENVIRONMENT || 'production'),
      // SENTRY_RELEASE: 优先使用环境变量，其次使用 Netlify COMMIT_REF，最后使用 package.json 版本
      'process.env.SENTRY_RELEASE': JSON.stringify(
        process.env.SENTRY_RELEASE ||
        (process.env.COMMIT_REF ? `esim-tools@${process.env.COMMIT_REF.slice(0, 7)}` : null) ||
        `esim-tools@${require('./package.json').version}`
      ),
    }),
    new CompressionPlugin({
      test: /\.(js|css|html|svg)$/,
      algorithm: 'gzip',
      threshold: 10240, // Only compress files > 10KB
      minRatio: 0.8,
      deleteOriginalAssets: false
    }),
    // Add Brotli compression for better compression ratio
    new CompressionPlugin({
      filename: '[path][base].br',
      algorithm: 'brotliCompress',
      test: /\.(js|css|html|svg)$/,
      compressionOptions: {
        params: {
          [require('zlib').constants.BROTLI_PARAM_QUALITY]: 11
        }
      },
      threshold: 10240,
      minRatio: 0.8,
      deleteOriginalAssets: false
    }),
    new GenerateSW({
      swDest: 'sw.js',
      clientsClaim: true,
      skipWaiting: true,
      cleanupOutdatedCaches: true,
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/api\.qrserver\.com/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'qr-cache',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 24 * 60 * 60 // 24 hours
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        {
          urlPattern: /^https:\/\/qrcode\.show/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'qr-cache',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 24 * 60 * 60
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        {
          urlPattern: /^https:\/\/api\.giffgaff\.com/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'giffgaff-api',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 5 * 60 // 5 minutes
            },
            networkTimeoutSeconds: 10,
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        {
          urlPattern: /^https:\/\/appapi\.simyo\.nl/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'simyo-api',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 5 * 60 // 5 minutes
            },
            networkTimeoutSeconds: 10,
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        }
      ]
    }),
    // Sentry Source Maps 上传（仅生产环境且配置完整时启用）
    ...(isSentryEnabled ? [sentryWebpackPlugin({
      authToken: sentryAuthToken,
      org: sentryOrg,
      project: sentryProject,
      release: {
        name: process.env.SENTRY_RELEASE ||
          (process.env.COMMIT_REF ? `esim-tools@${process.env.COMMIT_REF.slice(0, 7)}` : null) ||
          `esim-tools@${require('./package.json').version}`,
        // 自动关联 Git commits（需要在 Git 仓库中运行）
        setCommits: {
          auto: true,
          ignoreMissing: true
        }
      },
      sourcemaps: {
        // 上传 dist 目录下的 source maps
        assets: './dist/**/*.js.map',
        // 上传后删除本地 source maps（安全考虑）
        deleteFilesAfterUpload: './dist/**/*.js.map'
      },
      // 静默模式，减少构建日志
      silent: false,
      errorHandler: (err) => {
        console.warn('[Sentry] Source maps upload failed:', err.message);
        // 不阻止构建
      }
    })] : [])
  ],
  resolve: {
    extensions: ['.js', '.css'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@modules': path.resolve(__dirname, 'src/js/modules'),
      '@utils': path.resolve(__dirname, 'src/js/modules/utils')
    }
  },
  performance: {
    hints: 'warning',
    maxEntrypointSize: 512000, // 500KB
    maxAssetSize: 512000
  },
  devtool: 'source-map'
}; 