// @/integration-tests/index.test.ts
// Tests all APIs

// Import the server so coverage can be calculated
import _server from '../../source/app.js' // eslint-disable-line @typescript-eslint/no-unused-vars
import { fetch, fetchError } from '../helpers/request.js'
import { testData } from '../helpers/test-data.js'

// Typpeesssscccrriipppppttttttt
declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace jest {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		interface Matchers<R, T> {
			toMatchShapeOf(expected: any): R
			toMatchOneOf(expected: any[]): R
		}
	}
}

// Data to persist throughout the test
const users = { bofh: {}, pfy: {} }
const tokens = { bofh: {}, pfy: {} }

/**
 * Test the authentication endpoints.
 */
describe('auth', () => {
	describe('post /auth/signup', () => {
		test('invalid name', async () => {
			const data = await testData('auth/signup/bofh')
			const error = await fetchError({
				method: 'post',
				url: 'auth/signup',
				json: { ...data, name: 42 },
			})

			expect(error?.status).toEqual(400)
			expect(error?.code).toEqual('improper-payload')
		})

		test('invalid email', async () => {
			const data = await testData('auth/signup/bofh')
			const error = await fetchError({
				method: 'post',
				url: 'auth/signup',
				json: { ...data, email: 'weird!addr' },
			})

			expect(error?.status).toEqual(400)
			expect(error?.code).toEqual('improper-payload')
		})

		test('invalid password', async () => {
			const data = await testData('auth/signup/bofh')
			const error = await fetchError({
				method: 'post',
				url: 'auth/signup',
				json: { ...data, password: { invalid: 'value' } },
			})

			expect(error?.status).toEqual(400)
			expect(error?.code).toEqual('improper-payload')
		})

		test('weak password (< 6 letters)', async () => {
			const data = await testData('auth/signup/bofh')
			const error = await fetchError({
				method: 'post',
				url: 'auth/signup',
				json: { ...data, password: 'abcde' },
			})

			expect(error?.status).toEqual(400)
			expect(error?.code).toEqual('improper-payload')
		})

		test('successful request (bofh)', async () => {
			const data = await testData('auth/signup/bofh')
			const { body, status } = await fetch({
				method: 'post',
				url: 'auth/signup',
				json: data,
			})

			expect(status).toEqual(201)
			expect(body).toMatchShapeOf({
				user: {
					id: 'string',
					name: 'string',
					email: 'string',
					phone: undefined,
					lastSignedIn: 'string',
				},
				tokens: {
					bearer: 'string',
					refresh: 'string',
				},
			})

			users.bofh = body.user
			tokens.bofh = body.tokens
		})

		test('successful request (pfy)', async () => {
			const data = await testData('auth/signup/pfy')
			const { body, status } = await fetch({
				method: 'post',
				url: 'auth/signup',
				json: data,
			})

			expect(status).toEqual(201)
			expect(body).toMatchShapeOf({
				user: {
					id: 'string',
					name: 'string',
					email: 'string',
					phone: undefined,
					lastSignedIn: 'string',
				},
				tokens: {
					bearer: 'string',
					refresh: 'string',
				},
			})

			users.pfy = body.user
			tokens.pfy = body.tokens
		})
	})

	describe('post /auth/signin', () => {
		test('invalid email', async () => {
			const data = await testData('auth/signin/bofh')
			const error = await fetchError({
				method: 'post',
				url: 'auth/signin',
				json: { ...data, email: 'weird!addr' },
			})

			expect(error?.status).toEqual(400)
			expect(error?.code).toEqual('improper-payload')
		})

		test('invalid password', async () => {
			const data = await testData('auth/signin/bofh')
			const error = await fetchError({
				method: 'post',
				url: 'auth/signin',
				json: { ...data, password: { invalid: 'value' } },
			})

			expect(error?.status).toEqual(400)
			expect(error?.code).toEqual('improper-payload')
		})

		test('wrong password', async () => {
			const data = await testData('auth/signin/bofh')
			const error = await fetchError({
				method: 'post',
				url: 'auth/signin',
				json: { ...data, password: 'wrong-password' },
			})

			expect(error?.status).toEqual(401)
			expect(error?.code).toEqual('incorrect-credentials')
		})

		test('wrong email', async () => {
			const data = await testData('auth/signin/bofh')
			const error = await fetchError({
				method: 'post',
				url: 'auth/signin',
				json: { ...data, email: 'no-one@wreck.all' },
			})

			expect(error?.status).toEqual(404)
			expect(error?.code).toEqual('entity-not-found')
		})

		test('successful request (bofh)', async () => {
			const data = await testData('auth/signin/bofh')
			const { body, status } = await fetch({
				method: 'post',
				url: 'auth/signin',
				json: data,
			})

			expect(status).toEqual(200)
			expect(body).toMatchShapeOf({
				user: {
					id: 'string',
					name: 'string',
					email: 'string',
					phone: undefined,
					lastSignedIn: 'string',
				},
				tokens: {
					bearer: 'string',
					refresh: 'string',
				},
			})

			users.bofh = body.user
			tokens.bofh = body.tokens
		})

		test('successful request (pfy)', async () => {
			const data = await testData('auth/signin/bofh')
			const { body, status } = await fetch({
				method: 'post',
				url: 'auth/signin',
				json: data,
			})

			expect(status).toEqual(200)
			expect(body).toMatchShapeOf({
				user: {
					id: 'string',
					name: 'string',
					email: 'string',
					phone: undefined,
					lastSignedIn: 'string',
				},
				tokens: {
					bearer: 'string',
					refresh: 'string',
				},
			})

			users.pfy = body.user
			tokens.pfy = body.tokens
		})
	})
})
