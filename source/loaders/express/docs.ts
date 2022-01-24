// @/loaders/express/documentation.ts
// Parses the comments and generates the OpenAPI documentation for the API.

import { dirname, resolve as getAbsolutePath } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Application, Response, static as serve } from 'express'
import { middleware as validate } from 'express-openapi-validator'
import generateOpenApiSpec from 'express-jsdoc-swagger'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * The configuration for generating the OpenAPI spec.
 */
const config = {
	// Basic information about the API to include in the spec
	info: {
		title: 'The DoNew Today API',
		version: '0.1.0',
		description:
			'This is the documentation for the DoNew Today API. Pick an endpoint from the sidebar on the left to know more about it.',
	},
	servers: [
		{
			url: 'http://today.godonew.com',
			description: 'Public facing API server',
		},
		{
			url: 'http://localhost:5000',
			description: 'For local development only',
		},
	],
	security: {
		bearer: {
			type: 'http',
			scheme: 'bearer',
		},
	},

	// Extract comments from the following compiled files
	baseDir: getAbsolutePath(__dirname, '../source/'),
	filesPattern: [
		'routes/**/*.ts',
		'models/**/*.ts',
		'utils/errors.ts',
		'types.ts',
	],
	// Expose the generated JSON spec as /docs/spec.json
	exposeApiDocs: true,
	apiDocsPath: '/docs/spec.json',
}

/**
 * Parses the comments and generates the OpenAPI documentation for the API.
 * Exposes the generated spec with the /docs/spec.json endpoint.
 *
 * @param {Application} app - The Express application instance.
 */
const load = async (app: Application): Promise<void> => {
	// Generate the documentation
	const spec = await new Promise((resolve) => {
		generateOpenApiSpec(app)(config)
			.on('finish', resolve)
			.on('error', console.error)
	})
	// Render documentation using Elements
	app.use(
		'/docs',
		serve(getAbsolutePath(__dirname, '../assets/docs.html'), {
			// FIXME: Is this dangerous?
			setHeaders: (response: Response) =>
				response.setHeader('content-security-policy', ''),
		})
	)

	// Use the validation middleware
	app.use(
		validate({
			apiSpec: spec as any,
			validateSecurity: false, // Let us take care of authorization
		})
	)
}

export default load
