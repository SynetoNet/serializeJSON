const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');

module.exports = {
	entry: './src/serializejson.js',
	output: {
		path: path.resolve(__dirname, './dist'),
		filename: 'serializejson.js',
		library: {
			name: 'serializejson',
			type: 'umd',
			umdNamedDefine: true
		},
		globalObject: 'this'
	},
	devtool: 'source-map',
	optimization: {
		usedExports: 'global'
	},
	module: {
		rules: [
			{
				test: /\.(js|jsx)$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader'
				}
			}
		]
	},
	plugins: [
		new CleanWebpackPlugin({
			verbose: false
		}),
		new ESLintPlugin({
			exclude: ['node_modules'],
			fix: true
		})
	],
	resolve: {
		modules: [
			'node_modules'
		]
	}
};
