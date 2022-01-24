// @/integration-tests/index.test.ts
// Tests all APIs

// eslint-disable-next-line import/no-unassigned-import
import '../setup.js'

import { fetch, fetchError } from '../helpers/request.js'
import { testData } from '../helpers/test-data.js'

/**
 * Data to persist throughout the test
 */
const users: { bofh: any; pfy: any; groot: any } = {
	bofh: {},
	pfy: {},
	groot: {},
}
const tokens: { bofh: any; pfy: any; groot: any } = {
	bofh: {},
	pfy: {},
	groot: {},
}
const groups: { bastards: any; interns: any; groots: any } = {
	bastards: {},
	interns: {},
	groots: {},
}
const conversations: { quiz: any; updates: any } = {
	quiz: {},
	updates: {},
}
const questions: { capital: any; cleanest: any } = {
	capital: {},
	cleanest: {},
}

/**
 * Test the authentication endpoints and middleware.
 */
describe('auth', () => {
	describe('post /auth/signup', () => {
		it.each([
			['an invalid username is passed', { name: { invalid: 'value' } }],
			['an invalid email is passed', { email: 'weird!addr' }],
			['an invalid password is passed', { password: { invalid: 'value' } }],
			['a weak password (< 6 letters) is passed', { password: '1234' }],
		])(
			'should return a `improper-payload` error when %s',
			async (_situation: string, additionalTestData: any) => {
				const data = await testData('auth/signup/bofh')
				const error = await fetchError({
					method: 'post',
					url: `auth/signup`,
					json: { ...data, ...additionalTestData },
				})

				expect(error?.status).toEqual(400)
				expect(error?.code).toEqual('improper-payload')
			}
		)

		it.each(['bofh', 'pfy', 'groot'])(
			'should return the user and tokens upon a valid request (%s)',
			async (username: string) => {
				const data = await testData(`auth/signup/${username}`)
				const { body, status } = await fetch({
					method: 'post',
					url: `auth/signup`,
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

				users[username as 'bofh' | 'pfy' | 'groot'] = body.user
				tokens[username as 'bofh' | 'pfy' | 'groot'] = body.tokens

				if (username === 'groot') {
					const {
						body: { idToken, refreshToken },
					} = await fetch({
						method: 'post',
						prefixUrl:
							'http://localhost:9099/identitytoolkit.googleapis.com/v1',
						url: `accounts:update`,
						headers: {
							authorization: 'Bearer owner',
						},
						json: {
							localId: users.groot.id,
							displayName: data.name,
							email: data.email,
							password: data.password,
							customAttributes: '{"groot": true}',
						},
					})

					tokens.groot = {
						bearer: idToken,
						refresh: refreshToken,
					}
				}
			}
		)
	})

	describe('post /auth/signin', () => {
		it.each([
			['an invalid email is passed', { email: 'weird!addr' }],
			['an invalid password is passed', { password: { invalid: 'value' } }],
		])(
			'should return a `improper-payload` error when %s',
			async (_situation: string, additionalTestData: any) => {
				const data = await testData('auth/signin/bofh')
				const error = await fetchError({
					method: 'post',
					url: `auth/signin`,
					json: { ...data, ...additionalTestData },
				})

				expect(error?.status).toEqual(400)
				expect(error?.code).toEqual('improper-payload')
			}
		)

		it('should return a `incorrect-credentials` error when an incorrect password is passed', async () => {
			const data = await testData('auth/signin/bofh')
			const error = await fetchError({
				method: 'post',
				url: `auth/signin`,
				json: { ...data, password: 'wrong-password' },
			})

			expect(error?.status).toEqual(401)
			expect(error?.code).toEqual('incorrect-credentials')
		})

		it('should return a `entity-not-found` error when an email for a user that does not exist is passed', async () => {
			const data = await testData('auth/signin/bofh')
			const error = await fetchError({
				method: 'post',
				url: `auth/signin`,
				json: { ...data, email: 'no-one@wreck.all' },
			})

			expect(error?.status).toEqual(404)
			expect(error?.code).toEqual('entity-not-found')
		})

		it.each(['bofh', 'pfy', 'groot'])(
			'should return the user and tokens upon a valid request (%s)',
			async (username: string) => {
				const data = await testData(`auth/signin/${username}`)
				const { body, status } = await fetch({
					method: 'post',
					url: `auth/signin`,
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

				users[username as 'bofh' | 'pfy' | 'groot'] = body.user
				tokens[username as 'bofh' | 'pfy' | 'groot'] = body.tokens
			}
		)
	})

	describe('post /auth/refresh-token', () => {
		it('should return a `improper-payload` error when an invalid refresh token is passed', async () => {
			const data = await testData('auth/refresh-token/bofh', {
				refreshToken: 'weird!token',
			})
			const error = await fetchError({
				method: 'post',
				url: `auth/refresh-token`,
				json: data,
			})

			expect(error?.status).toEqual(400)
			expect(error?.code).toEqual('improper-payload')
		})

		it('should return a new set of tokens upon a valid request', async () => {
			const data = await testData('auth/refresh-token/bofh', {
				refreshToken: tokens.bofh.refresh,
			})
			const { body, status } = await fetch({
				method: 'post',
				url: `auth/refresh-token`,
				json: data,
			})

			expect(status).toEqual(200)
			expect(body).toMatchShapeOf({
				tokens: {
					bearer: 'string',
					refresh: 'string',
				},
			})

			tokens.bofh = body.tokens
		})
	})

	describe('test authn middleware', () => {
		it.each([
			['a token is not passed', ''],
			['an invalid token is passed', 'weird!token'],
		])(
			'should return a `invalid-token` error when %s',
			async (_situation: string, bearerToken: string) => {
				const error = await fetchError({
					method: 'get',
					url: `pong`,
					headers: {
						authorization: bearerToken,
					},
				})

				expect(error?.status).toEqual(401)
				expect(error?.code).toEqual('invalid-token')
			}
		)

		it('should parse bearer tokens in the `authorization` header with the `Bearer` prefix', async () => {
			const { body, status } = await fetch({
				method: 'get',
				url: `pong`,
				headers: {
					authorization: `Bearer ${tokens.bofh.bearer}`,
				},
			})

			expect(body).toBeTruthy()
			expect(status).toEqual(200)
		})

		it('should parse bearer tokens in the `authorization` header without the `Bearer` prefix', async () => {
			const { body, status } = await fetch({
				method: 'get',
				url: `pong`,
				headers: {
					authorization: tokens.bofh.bearer,
				},
			})

			expect(body).toBeTruthy()
			expect(status).toEqual(200)
		})
	})
})

/**
 * Test the group endpoints.
 */
describe('groups', () => {
	describe('post /groups', () => {
		it.each([
			['an invalid name is passed', { name: { invalid: 'value' } }],
			// FIXME: These tests don't work?!
			/*
			[ 'an invalid participants list is passed', { participants: { 'The BOFH': ['mentee'] } } ],
			[ 'an invalid conversation list is passed', { conversations: { quiz: 'mentee' } } ],
			[ 'an invalid report list is passed', { reports: { 'quiz-score': 'mentee' } } ],
			*/
			['an invalid code is passed', { code: ['the-bastards', 'sys-admin'] }],
		])(
			'should return a `improper-payload` error when %s',
			async (_situation: string, additionalTestData: any) => {
				const data = await testData('groups/create/bastards')
				const error = await fetchError({
					method: 'post',
					url: `groups`,
					json: { ...data, ...additionalTestData },
					headers: {
						authorization: tokens.groot.bearer,
					},
				})

				expect(error?.status).toEqual(400)
				expect(error?.code).toEqual('improper-payload')
			}
		)

		it('should return a `not-allowed` error when the requesting user is not groot', async () => {
			const data = await testData('groups/create/bastards')
			const error = await fetchError({
				method: 'post',
				url: `groups`,
				json: data,
				headers: {
					authorization: tokens.bofh.bearer,
				},
			})

			expect(error?.status).toEqual(403)
			expect(error?.code).toEqual('not-allowed')
		})

		it.each(['bastards', 'interns', 'groots'])(
			'should return the created group upon a valid request (%s)',
			async (groupName: string) => {
				const data = await testData(`groups/create/${groupName}`, {
					bofh: users.bofh.id,
					pfy: users.pfy.id,
					groot: users.groot.id,
				})
				const { body, status } = await fetch({
					method: 'post',
					url: `groups`,
					json: data,
					headers: {
						authorization: tokens.groot.bearer,
					},
				})

				expect(status).toEqual(201)
				expect(body.group).toMatchShapeOf({
					id: 'string',
					name: 'string',
					participants: {},
					conversations: {},
					reports: {},
					code: 'string',
				})

				groups[groupName as 'bastards' | 'interns' | 'groots'] = body.group
			}
		)
	})

	describe('put /groups/{groupId}', () => {
		it.each([
			['an invalid name is passed', { name: { invalid: 'value' } }],
			// FIXME: These tests don't work?!
			/*
			[ 'an invalid participants list is passed', { participants: { 'The BOFH': ['mentee'] } } ],
			[ 'an invalid conversation list is passed', { conversations: { quiz: 'mentee' } } ],
			[ 'an invalid report list is passed', { reports: { 'quiz-score': 'mentee' } } ],
			*/
			['an invalid code is passed', { code: ['the-bastards', 'sys-admin'] }],
		])(
			'should return a `improper-payload` error when %s',
			async (_situation: string, additionalTestData: any) => {
				const data = await testData('groups/update/bastards')
				const error = await fetchError({
					method: 'put',
					url: `groups/${groups.bastards.id}`,
					json: { ...data, ...additionalTestData },
					headers: {
						authorization: tokens.groot.bearer,
					},
				})

				expect(error?.status).toEqual(400)
				expect(error?.code).toEqual('improper-payload')
			}
		)

		it('should return a `improper-payload` error when the payload is incomplete', async () => {
			const error = await fetchError({
				method: 'put',
				url: `groups/${groups.bastards.id}`,
				json: { name: 'Weird Name' },
				headers: {
					authorization: tokens.groot.bearer,
				},
			})

			expect(error?.status).toEqual(400)
			expect(error?.code).toEqual('improper-payload')
		})

		it('should return a `not-allowed` error when the requesting user is not groot and not a supermentor in the group', async () => {
			const data = await testData('groups/update/bastards')
			const error = await fetchError({
				method: 'put',
				url: `groups/${groups.bastards.id}`,
				json: data,
				headers: {
					authorization: tokens.pfy.bearer,
				},
			})

			expect(error?.status).toEqual(403)
			expect(error?.code).toEqual('not-allowed')
		})

		it.each([
			['bastards', 'a supermentor in the group', 'bofh'],
			['interns', 'groot', 'groot'],
		])(
			'should update the group (%s) upon a valid request by %s',
			async (groupName: string, _situation: string, username: string) => {
				const data = await testData(`groups/update/${groupName}`, {
					bofh: users.bofh.id,
					pfy: users.pfy.id,
					groot: users.groot.id,
				})
				const { body, status } = await fetch({
					method: 'put',
					url: `groups/${groups[groupName as 'bastards' | 'interns'].id}`,
					json: data,
					headers: {
						authorization: tokens[username as 'bofh' | 'groot'].bearer,
					},
				})

				expect(status).toEqual(200)
				expect(body.group).toMatchShapeOf({
					id: 'string',
					name: 'string',
					participants: {},
					conversations: {},
					reports: {},
					code: 'string',
				})

				groups[groupName as 'bastards' | 'interns'] = body.group
			}
		)
	})

	describe('put /groups/join', () => {
		it('should return a `improper-payload` error when an invalid code is passed', async () => {
			const error = await fetchError({
				method: 'put',
				url: `groups/join`,
				json: { code: ['weird!code'] },
				headers: {
					authorization: tokens.pfy.bearer,
				},
			})

			expect(error?.status).toEqual(400)
			expect(error?.code).toEqual('improper-payload')
		})

		it('should return an `entity-not-found` error when a code not associated with a group is passed', async () => {
			const error = await fetchError({
				method: 'put',
				url: `groups/join`,
				json: { code: 'weird!code' },
				headers: {
					authorization: tokens.pfy.bearer,
				},
			})

			expect(error?.status).toEqual(404)
			expect(error?.code).toEqual('entity-not-found')
		})

		it('should add the requesting user to the group upon a valid request', async () => {
			const { body, status } = await fetch({
				method: 'put',
				url: `groups/join`,
				json: { code: groups.bastards.code },
				headers: {
					authorization: tokens.pfy.bearer,
				},
			})

			expect(status).toEqual(200)
			expect(body.group).toMatchShapeOf({
				id: 'string',
				name: 'string',
				participants: {},
				conversations: {},
				reports: {},
				code: 'string',
			})

			groups.bastards = body.group
		})
	})

	describe('get /groups', () => {
		it('should return all groups if the requesting user is groot', async () => {
			const { body, status } = await fetch({
				method: 'get',
				url: `groups`,
				headers: {
					authorization: tokens.groot.bearer,
				},
			})

			expect(status).toEqual(200)
			expect(body.groups.length).toEqual(3)
			expect(body.groups).toMatchShapeOf([
				{
					id: 'string',
					name: 'string',
					participants: {},
					conversations: {},
					reports: {},
					code: 'string',
				},
			])
		})

		it('should only list groups the requesting user is a part of upon a valid request', async () => {
			const { body, status } = await fetch({
				method: 'get',
				url: `groups`,
				headers: {
					authorization: tokens.pfy.bearer,
				},
			})

			expect(status).toEqual(200)
			expect(body.groups.length).toEqual(2)
			expect(body.groups).toMatchShapeOf([
				{
					id: 'string',
					name: 'string',
					participants: {},
					conversations: {},
					reports: {},
					code: 'string',
				},
			])
		})
	})

	describe('get /groups/{groupId}', () => {
		it('should return a `entity-not-found` error when the requested group is not found', async () => {
			const error = await fetchError({
				method: 'get',
				url: `groups/weird`,
				headers: {
					authorization: tokens.bofh.bearer,
				},
			})

			expect(error?.status).toEqual(404)
			expect(error?.code).toEqual('entity-not-found')
		})

		it('should return a `not-allowed` error when the requesting user is not a part of the requested group', async () => {
			const error = await fetchError({
				method: 'get',
				url: `groups/${groups.groots.id}`,
				headers: {
					authorization: tokens.pfy.bearer,
				},
			})

			expect(error?.status).toEqual(403)
			expect(error?.code).toEqual('not-allowed')
		})

		it('should return the requested group when requesting user is a part of the group', async () => {
			const { body, status } = await fetch({
				method: 'get',
				url: `groups/${groups.interns.id}`,
				headers: {
					authorization: tokens.pfy.bearer,
				},
			})

			expect(status).toEqual(200)
			expect(body.group).toMatchShapeOf({
				id: 'string',
				name: 'string',
				participants: {
					[users.pfy.id]: 'mentee',
				},
				conversations: {},
				reports: {},
				code: 'string',
			})
		})

		it('should return the requested group when requesting user is groot', async () => {
			const { body, status } = await fetch({
				method: 'get',
				url: `groups/${groups.interns.id}`,
				headers: {
					authorization: tokens.groot.bearer,
				},
			})

			expect(status).toEqual(200)
			expect(body.group).toMatchShapeOf({
				id: 'string',
				name: 'string',
				participants: {
					[users.pfy.id]: 'mentee',
				},
				conversations: {},
				reports: {},
				code: 'string',
			})
		})
	})

	describe('delete /groups/{groupId}', () => {
		// FIXME: Known issue: even if the document does not exist, Firebase just returns a successful response
		it.skip('should return a `entity-not-found` error when the requested group is not found', async () => {
			const error = await fetchError({
				method: 'delete',
				url: `groups/weird`,
				headers: {
					authorization: tokens.groot.bearer,
				},
			})

			expect(error?.status).toEqual(404)
			expect(error?.code).toEqual('entity-not-found')
		})

		it('should return a `not-allowed` error when the requesting user is not a part of the requested group', async () => {
			const error = await fetchError({
				method: 'delete',
				url: `groups/${groups.groots.id}`,
				headers: {
					authorization: tokens.pfy.bearer,
				},
			})

			expect(error?.status).toEqual(403)
			expect(error?.code).toEqual('not-allowed')
		})

		it('should delete the specified group when requesting user is groot', async () => {
			const { status } = await fetch({
				method: 'delete',
				url: `groups/${groups.groots.id}`,
				headers: {
					authorization: tokens.groot.bearer,
				},
			})

			expect(status).toEqual(204)
		})
	})
})

/**
 * Test the user profile endpoints.
 */
describe('users', () => {
	describe('get /users', () => {
		it('should return a `not-allowed` error when the client is not groot', async () => {
			const error = await fetchError({
				method: 'get',
				url: `users`,
				headers: {
					authorization: tokens.pfy.bearer,
				},
			})

			expect(error?.status).toEqual(403)
			expect(error?.code).toEqual('not-allowed')
		})

		it('should return a list of users upon a valid request', async () => {
			const { body, status } = await fetch({
				method: 'get',
				url: `users`,
				headers: {
					authorization: tokens.groot.bearer,
				},
			})

			expect(status).toEqual(200)
			expect(body.users.length).toEqual(3)
			expect(body.users).toMatchShapeOf([
				{
					id: 'string',
					name: 'string',
					email: 'string',
					phone: undefined,
					lastSignedIn: 'string',
				},
			])
		})
	})

	describe('get /users/{userId}', () => {
		it('should return a `not-allowed` error when the requested user is not found but the requesting user is not groot', async () => {
			const error = await fetchError({
				method: 'get',
				url: `users/weird`,
				headers: {
					authorization: tokens.bofh.bearer,
				},
			})

			expect(error?.status).toEqual(403)
			expect(error?.code).toEqual('not-allowed')
		})

		it('should return a `not-allowed` error when the requesting user is not a mentor/supermentor of the requested user', async () => {
			const error = await fetchError({
				method: 'get',
				url: `users/${users.bofh.id}`,
				headers: {
					authorization: tokens.pfy.bearer,
				},
			})

			expect(error?.status).toEqual(403)
			expect(error?.code).toEqual('not-allowed')
		})

		it('should return a `entity-not-found` error when the requested user is not found but the requesting user is groot', async () => {
			const error = await fetchError({
				method: 'get',
				url: `users/weird`,
				headers: {
					authorization: tokens.groot.bearer,
				},
			})

			expect(error?.status).toEqual(404)
			expect(error?.code).toEqual('entity-not-found')
		})

		it('should return the requested user when requesting user is groot', async () => {
			const { body, status } = await fetch({
				method: 'get',
				url: `users/${users.bofh.id}`,
				headers: {
					authorization: tokens.groot.bearer,
				},
			})

			expect(status).toEqual(200)
			expect(body.user).toMatchShapeOf({
				id: 'string',
				name: 'string',
				email: 'string',
				phone: undefined,
				lastSignedIn: 'string',
			})
		})

		// TODO: Add test for when one user is mentor/supermentor of another
	})
})

/**
 * Test the attribute endpoints.
 */
describe('attributes', () => {
	describe('post /users/{userId}/attributes', () => {
		it.each([
			['an invalid ID is passed', { id: { invalid: 'value' } }],
			['an invalid value is passed', { value: { some: 'thing' } }],
		])(
			'should return a `improper-payload` error when %s',
			async (_situation: string, additionalTestData: any) => {
				const data = await testData('attributes/create/smartness')
				const error = await fetchError({
					method: 'post',
					url: `users/${users.pfy.id}/attributes`,
					json: { ...data, ...additionalTestData },
					headers: {
						authorization: tokens.groot.bearer,
					},
				})

				expect(error?.status).toEqual(400)
				expect(error?.code).toEqual('improper-payload')
			}
		)

		it('should return a `not-allowed` error when creating an attribute for another user and you are not their mentor/supermentor', async () => {
			const data = await testData('attributes/create/smartness')
			const error = await fetchError({
				method: 'post',
				url: `users/${users.bofh.id}/attributes`,
				json: data,
				headers: {
					authorization: tokens.pfy.bearer,
				},
			})

			expect(error?.status).toEqual(403)
			expect(error?.code).toEqual('not-allowed')
		})

		it.each(['smartness', 'niceness'])(
			'should return the created attribute upon a valid request (%s)',
			async (attributeId: string) => {
				const data = await testData(`attributes/create/${attributeId}`)
				const { body, status } = await fetch({
					method: 'post',
					url: `users/${users.pfy.id}/attributes`,
					json: data,
					headers: {
						authorization: tokens.bofh.bearer,
					},
				})

				expect(status).toEqual(201)
				expect(body.attribute).toMatchShapeOf({
					id: 'string',
					value: 0,
					history: [
						{
							value: 0,
							observer: 'string',
							timestamp: 'string',
						},
					],
				})
			}
		)
	})

	describe('put /users/{userId}/attributes/{attributeId}', () => {
		it.each([
			['an invalid value is passed', { value: { some: 'thing' } }],
			['an invalid message is passed', { message: 'weird!message!id' }],
		])(
			'should return a `improper-payload` error when %s',
			async (_situation: string, additionalTestData: any) => {
				const data = await testData('attributes/update/smartness')
				const error = await fetchError({
					method: 'put',
					url: `users/${users.pfy.id}/attributes/smartness`,
					json: { ...data, ...additionalTestData },
					headers: {
						authorization: tokens.groot.bearer,
					},
				})

				expect(error?.status).toEqual(400)
				expect(error?.code).toEqual('improper-payload')
			}
		)

		it('should return a `not-allowed` error when updating an attribute for another user and you are not their mentor/supermentor', async () => {
			const data = await testData('attributes/update/smartness')
			const error = await fetchError({
				method: 'put',
				url: `users/${users.bofh.id}/attributes/smartness`,
				json: data,
				headers: {
					authorization: tokens.pfy.bearer,
				},
			})

			expect(error?.status).toEqual(403)
			expect(error?.code).toEqual('not-allowed')
		})

		it.each(['smartness', 'niceness'])(
			'should return the updated attribute upon a valid request (%s)',
			async (attributeId: string) => {
				const data = await testData(`attributes/update/${attributeId}`)
				const { body, status } = await fetch({
					method: 'put',
					url: `users/${users.pfy.id}/attributes/${attributeId}`,
					json: data,
					headers: {
						authorization: tokens.groot.bearer,
					},
				})

				expect(status).toEqual(200)
				expect(body.attribute).toMatchShapeOf({
					id: 'string',
					value: 0,
					history: [
						{
							value: 0,
							observer: 'string',
							timestamp: 'string',
						},
					],
				})
			}
		)
	})

	describe('get /users/{userId}/attributes', () => {
		it('should return a `not-allowed` error when the requesting user is not the user themselves or their mentor/supermentor', async () => {
			const error = await fetchError({
				method: 'get',
				url: `users/${users.bofh.id}/attributes/niceness`,
				headers: {
					authorization: tokens.pfy.bearer,
				},
			})

			expect(error?.status).toEqual(403)
			expect(error?.code).toEqual('not-allowed')
		})

		it('should return the attributes of a user when requesting user is the user themselves', async () => {
			const { body, status } = await fetch({
				method: 'get',
				url: `users/${users.pfy.id}/attributes`,
				headers: {
					authorization: tokens.pfy.bearer,
				},
			})

			expect(status).toEqual(200)
			expect(body.attributes.length).toEqual(2)
			expect(body.attributes).toMatchShapeOf([
				{
					id: 'string',
					value: 0,
					history: [
						{
							value: 0,
							observer: 'string',
							timestamp: 'string',
						},
					],
				},
			])
		})

		it('should return the attributes of a user when requesting user is a mentor/supermentor of the user', async () => {
			const { body, status } = await fetch({
				method: 'get',
				url: `users/${users.pfy.id}/attributes`,
				headers: {
					authorization: tokens.bofh.bearer,
				},
			})

			expect(status).toEqual(200)
			expect(body.attributes.length).toEqual(2)
			expect(body.attributes).toMatchShapeOf([
				{
					id: 'string',
					value: 0,
					history: [
						{
							value: 0,
							observer: 'string',
							timestamp: 'string',
						},
					],
				},
			])
		})
	})

	describe('get /users/{userId}/attributes/{attributeId}', () => {
		it('should return a `entity-not-found` error when the requested attribute is not found', async () => {
			const error = await fetchError({
				method: 'get',
				url: `users/${users.pfy.id}/attributes/weird`,
				headers: {
					authorization: tokens.bofh.bearer,
				},
			})

			expect(error?.status).toEqual(404)
			expect(error?.code).toEqual('entity-not-found')
		})

		it('should return a `not-allowed` error when the requesting user is not the user themselves or their mentor/supermentor', async () => {
			const error = await fetchError({
				method: 'get',
				url: `users/${users.bofh.id}/attributes/niceness`,
				headers: {
					authorization: tokens.pfy.bearer,
				},
			})

			expect(error?.status).toEqual(403)
			expect(error?.code).toEqual('not-allowed')
		})

		it('should return the requested attribute when requesting user is the user themselves', async () => {
			const { body, status } = await fetch({
				method: 'get',
				url: `users/${users.pfy.id}/attributes/niceness`,
				headers: {
					authorization: tokens.pfy.bearer,
				},
			})

			expect(status).toEqual(200)
			expect(body.attribute).toMatchShapeOf({
				id: 'string',
				value: 0,
				history: [
					{
						value: 0,
						observer: 'string',
						timestamp: 'string',
					},
				],
			})
		})

		it('should return the requested attribute when requesting user is a mentor/supermentor of the user', async () => {
			const { body, status } = await fetch({
				method: 'get',
				url: `users/${users.pfy.id}/attributes/niceness`,
				headers: {
					authorization: tokens.bofh.bearer,
				},
			})

			expect(status).toEqual(200)
			expect(body.attribute).toMatchShapeOf({
				id: 'string',
				value: 0,
				history: [
					{
						value: 0,
						observer: 'string',
						timestamp: 'string',
					},
				],
			})
		})
	})

	describe('delete /users/{userId}/attributes/{attributeId}', () => {
		// FIXME: Known issue: even if the document does not exist, Firebase just returns a successful response
		it.skip('should return a `entity-not-found` error when the requested attribute is not found', async () => {
			const error = await fetchError({
				method: 'delete',
				url: `users/${users.pfy.id}/attributes/weird`,
				headers: {
					authorization: tokens.groot.bearer,
				},
			})

			expect(error?.status).toEqual(404)
			expect(error?.code).toEqual('entity-not-found')
		})

		it('should return a `not-allowed` error when the requesting user is the user themselves', async () => {
			const error = await fetchError({
				method: 'delete',
				url: `users/${users.pfy.id}/attributes/niceness`,
				headers: {
					authorization: tokens.pfy.bearer,
				},
			})

			expect(error?.status).toEqual(403)
			expect(error?.code).toEqual('not-allowed')
		})

		it('should delete the specified attribute when requesting user is a supermentor of the user', async () => {
			const { status } = await fetch({
				method: 'delete',
				url: `users/${users.pfy.id}/attributes/niceness`,
				headers: {
					authorization: tokens.bofh.bearer,
				},
			})

			expect(status).toEqual(204)
		})
	})
})

/**
 * Test the conversation endpoints.
 */
describe('conversations', () => {
	describe('post /conversations', () => {
		it.each([
			['an invalid name is passed', { name: { invalid: 'value' } }],
			['an invalid description is passed', { description: true }],
			['an invalid once is passed', { once: 'yes' }],
			['an invalid tags list is passed', { tags: 'quiz' }],
		])(
			'should return a `improper-payload` error when %s',
			async (_situation: string, additionalTestData: any) => {
				const data = await testData('conversations/create/quiz')
				const error = await fetchError({
					method: 'post',
					url: `conversations`,
					json: { ...data, ...additionalTestData },
					headers: {
						authorization: tokens.groot.bearer,
					},
				})

				expect(error?.status).toEqual(400)
				expect(error?.code).toEqual('improper-payload')
			}
		)

		it('should return a `not-allowed` error when the requesting user is not groot', async () => {
			const data = await testData('conversations/create/quiz')
			const error = await fetchError({
				method: 'post',
				url: `conversations`,
				json: data,
				headers: {
					authorization: tokens.bofh.bearer,
				},
			})

			expect(error?.status).toEqual(403)
			expect(error?.code).toEqual('not-allowed')
		})

		it.each(['quiz', 'updates'])(
			'should return the created conversation upon a valid request (%s)',
			async (conversationName: string) => {
				const data = await testData(`conversations/create/${conversationName}`)
				const { body, status } = await fetch({
					method: 'post',
					url: `conversations`,
					json: data,
					headers: {
						authorization: tokens.groot.bearer,
					},
				})

				expect(status).toEqual(201)
				expect(body.conversation).toMatchShapeOf({
					id: 'string',
					name: 'string',
					description: 'string',
					once: true,
					tags: ['string'],
				})

				conversations[conversationName as 'quiz' | 'updates'] =
					body.conversation
			}
		)

		it.each(['bastards', 'interns'])(
			'should update the group (%s) conversation list',
			async (groupName: string) => {
				const data = await testData(`groups/update/${groupName}`, {
					bofh: users.bofh.id,
					pfy: users.pfy.id,
					groot: users.groot.id,
					updates: conversations.updates.id,
					quiz: conversations.quiz.id,
				})
				const { body, status } = await fetch({
					method: 'put',
					url: `groups/${groups[groupName as 'bastards' | 'interns'].id}`,
					json: data,
					headers: {
						authorization: tokens.groot.bearer,
					},
				})

				expect(status).toEqual(200)
				expect(body.group).toMatchShapeOf({
					id: 'string',
					name: 'string',
					participants: {},
					conversations: {},
					reports: {},
					code: 'string',
				})

				groups[groupName as 'bastards' | 'interns'] = body.group
			}
		)
	})

	describe('put /conversations/{conversationId}', () => {
		it.each([
			['an invalid name is passed', { name: { invalid: 'value' } }],
			['an invalid description is passed', { description: true }],
			['an invalid once is passed', { once: 'yes' }],
			['an invalid tags list is passed', { tags: 'quiz' }],
		])(
			'should return a `improper-payload` error when %s',
			async (_situation: string, additionalTestData: any) => {
				const data = await testData('conversations/update/quiz')
				const error = await fetchError({
					method: 'put',
					url: `conversations/${conversations.updates.id}`,
					json: { ...data, ...additionalTestData },
					headers: {
						authorization: tokens.groot.bearer,
					},
				})

				expect(error?.status).toEqual(400)
				expect(error?.code).toEqual('improper-payload')
			}
		)

		it('should return a `not-allowed` error when the requesting user is not groot', async () => {
			const data = await testData('conversations/update/quiz')
			const error = await fetchError({
				method: 'put',
				url: `conversations/${conversations.updates.id}`,
				json: data,
				headers: {
					authorization: tokens.bofh.bearer,
				},
			})

			expect(error?.status).toEqual(403)
			expect(error?.code).toEqual('not-allowed')
		})

		it.each(['quiz', 'updates'])(
			'should return the updated conversation upon a valid request (%s)',
			async (conversationName: string) => {
				const data = await testData(`conversations/update/${conversationName}`)
				const { body, status } = await fetch({
					method: 'put',
					url: `conversations/${
						conversations[conversationName as 'quiz' | 'updates'].id
					}`,
					json: data,
					headers: {
						authorization: tokens.groot.bearer,
					},
				})

				expect(status).toEqual(200)
				expect(body.conversation).toMatchShapeOf({
					id: 'string',
					name: 'string',
					description: 'string',
					once: true,
					tags: ['string'],
				})

				conversations[conversationName as 'quiz' | 'updates'] =
					body.conversation
			}
		)
	})

	describe('get /conversations', () => {
		it('should return all conversations if the requesting user is groot', async () => {
			const { body, status } = await fetch({
				method: 'get',
				url: `conversations`,
				headers: {
					authorization: tokens.groot.bearer,
				},
			})

			expect(status).toEqual(200)
			expect(body.conversations.length).toEqual(2)
			expect(body.conversations).toMatchShapeOf([
				{
					id: 'string',
					name: 'string',
					description: 'string',
					once: true,
					tags: ['string'],
				},
			])
		})

		it('should return a `not-allowed` error if the requesting user is not groot', async () => {
			const error = await fetchError({
				method: 'get',
				url: `conversations`,
				headers: {
					authorization: tokens.pfy.bearer,
				},
			})

			expect(error?.status).toEqual(403)
			expect(error?.code).toEqual('not-allowed')
		})
	})

	describe('get /conversations/{conversationId}', () => {
		it('should return a `entity-not-found` error when the requested conversation is not found', async () => {
			const error = await fetchError({
				method: 'get',
				url: `conversations/weird`,
				headers: {
					authorization: tokens.groot.bearer,
				},
			})

			expect(error?.status).toEqual(404)
			expect(error?.code).toEqual('entity-not-found')
		})

		it('should return a `not-allowed` error when the requesting user is not a part of the requested conversation', async () => {
			const error = await fetchError({
				method: 'get',
				url: `conversations/${conversations.updates.id}`,
				headers: {
					authorization: tokens.pfy.bearer,
				},
			})

			expect(error?.status).toEqual(403)
			expect(error?.code).toEqual('not-allowed')
		})

		it('should return the requested conversation when requesting user is allowed to take the conversation', async () => {
			const { body, status } = await fetch({
				method: 'get',
				url: `conversations/${conversations.quiz.id}`,
				headers: {
					authorization: tokens.bofh.bearer,
				},
			})

			expect(status).toEqual(200)
			expect(body.conversation).toMatchShapeOf({
				id: 'string',
				name: 'string',
				description: 'string',
				once: true,
				tags: ['string'],
			})
		})

		it('should return the requested conversation when requesting user is groot', async () => {
			const { body, status } = await fetch({
				method: 'get',
				url: `conversations/${conversations.updates.id}`,
				headers: {
					authorization: tokens.groot.bearer,
				},
			})

			expect(status).toEqual(200)
			expect(body.conversation).toMatchShapeOf({
				id: 'string',
				name: 'string',
				description: 'string',
				once: true,
				tags: ['string'],
			})
		})
	})

	describe('delete /conversations/{conversationId}', () => {
		// FIXME: Known issue: even if the document does not exist, Firebase just returns a successful response
		it.skip('should return a `entity-not-found` error when the requested conversation is not found', async () => {
			const error = await fetchError({
				method: 'delete',
				url: `conversations/weird`,
				headers: {
					authorization: tokens.groot.bearer,
				},
			})

			expect(error?.status).toEqual(404)
			expect(error?.code).toEqual('entity-not-found')
		})

		it('should return a `not-allowed` error when the requesting user is not a part of the requested conversation', async () => {
			const error = await fetchError({
				method: 'delete',
				url: `conversations/${conversations.updates.id}`,
				headers: {
					authorization: tokens.pfy.bearer,
				},
			})

			expect(error?.status).toEqual(403)
			expect(error?.code).toEqual('not-allowed')
		})

		it('should delete the specified conversation when requesting user is groot', async () => {
			const { status } = await fetch({
				method: 'delete',
				url: `conversations/${conversations.updates.id}`,
				headers: {
					authorization: tokens.groot.bearer,
				},
			})

			expect(status).toEqual(204)
		})
	})
})

/**
 * Test the question endpoints.
 */
describe('questions', () => {
	describe('post /conversations/{conversationId}/questions', () => {
		it.each([
			['an invalid text is passed', { text: { invalid: 'value' } }],
			['an invalid options list is passed', { options: { text: 'something' } }],
			['an invalid first is passed', { first: 'yes' }],
			['an invalid last is passed', { last: 'no' }],
			[
				'an invalid randomizeOptionOrder is passed',
				{ randomizeOptionOrder: 'yes' },
			],
			['an invalid tags list is passed', { tags: 'quiz' }],
		])(
			'should return a `improper-payload` error when %s',
			async (_situation: string, additionalTestData: any) => {
				const data = await testData('questions/create/capital')
				const error = await fetchError({
					method: 'post',
					url: `conversations/${conversations.quiz.id}/questions`,
					json: { ...data, ...additionalTestData },
					headers: {
						authorization: tokens.groot.bearer,
					},
				})

				expect(error?.status).toEqual(400)
				expect(error?.code).toEqual('improper-payload')
			}
		)

		it('should return a `not-allowed` error when the requesting user is not groot', async () => {
			const data = await testData('questions/create/capital')
			const error = await fetchError({
				method: 'post',
				url: `conversations/${conversations.quiz.id}/questions`,
				json: data,
				headers: {
					authorization: tokens.bofh.bearer,
				},
			})

			expect(error?.status).toEqual(403)
			expect(error?.code).toEqual('not-allowed')
		})

		it.each(['capital', 'cleanest'])(
			'should return the created question upon a valid request (%s)',
			async (questionName: string) => {
				const data = await testData(`questions/create/${questionName}`)
				const { body, status } = await fetch({
					method: 'post',
					url: `conversations/${conversations.quiz.id}/questions`,
					json: data,
					headers: {
						authorization: tokens.groot.bearer,
					},
				})

				expect(status).toEqual(201)
				expect(body.question).toMatchShapeOf({
					id: 'string',
					text: 'string',
					options: [
						{
							position: 1,
							type: 'string',
							text: 'string',
							attribute: {
								id: 'string',
								value: 1,
							},
						},
					],
					first: true,
					last: false,
					randomizeOptionOrder: true,
					tags: ['string'],
				})

				questions[questionName as 'capital' | 'cleanest'] = body.question
			}
		)
	})

	describe('put /conversations/{conversationId}/questions/{questionId}', () => {
		it.each([
			['an invalid text is passed', { text: { invalid: 'value' } }],
			['an invalid options list is passed', { options: { text: 'something' } }],
			['an invalid first is passed', { first: 'yes' }],
			['an invalid last is passed', { last: 'no' }],
			[
				'an invalid randomizeOptionOrder is passed',
				{ randomizeOptionOrder: 'yes' },
			],
			['an invalid tags list is passed', { tags: 'quiz' }],
		])(
			'should return a `improper-payload` error when %s',
			async (_situation: string, additionalTestData: any) => {
				const data = await testData('questions/update/capital')
				const error = await fetchError({
					method: 'put',
					url: `conversations/${conversations.quiz.id}/questions/${questions.cleanest.id}`,
					json: { ...data, ...additionalTestData },
					headers: {
						authorization: tokens.groot.bearer,
					},
				})

				expect(error?.status).toEqual(400)
				expect(error?.code).toEqual('improper-payload')
			}
		)

		it('should return a `not-allowed` error when the requesting user is not groot', async () => {
			const data = await testData('questions/update/capital')
			const error = await fetchError({
				method: 'put',
				url: `conversations/${conversations.quiz.id}/questions/${questions.cleanest.id}`,
				json: data,
				headers: {
					authorization: tokens.bofh.bearer,
				},
			})

			expect(error?.status).toEqual(403)
			expect(error?.code).toEqual('not-allowed')
		})

		it.each(['capital', 'cleanest'])(
			'should return the updated question upon a valid request (%s)',
			async (questionName: string) => {
				const data = await testData(`questions/update/${questionName}`)
				const { body, status } = await fetch({
					method: 'put',
					url: `conversations/${conversations.quiz.id}/questions/${
						questions[questionName as 'capital' | 'cleanest'].id
					}`,
					json: data,
					headers: {
						authorization: tokens.groot.bearer,
					},
				})

				expect(status).toEqual(200)
				expect(body.question).toMatchShapeOf({
					id: 'string',
					text: 'string',
					options: [
						{
							position: 1,
							type: 'string',
							text: 'string',
							attribute: {
								id: 'string',
								value: 1,
							},
						},
					],
					first: true,
					last: false,
					randomizeOptionOrder: true,
					tags: ['string'],
				})

				questions[questionName as 'capital' | 'cleanest'] = body.question
			}
		)
	})

	describe('get /conversations/{conversationId}/questions', () => {
		it('should return all questions if the requesting user is groot', async () => {
			const { body, status } = await fetch({
				method: 'get',
				url: `conversations/${conversations.quiz.id}/questions`,
				headers: {
					authorization: tokens.groot.bearer,
				},
			})

			expect(status).toEqual(200)
			expect(body.questions.length).toEqual(2)
			expect(body.questions).toMatchShapeOf({
				id: 'string',
				text: 'string',
				options: [
					{
						position: 1,
						type: 'string',
						text: 'string',
						attribute: {
							id: 'string',
							value: 1,
						},
					},
				],
				first: true,
				last: false,
				randomizeOptionOrder: true,
				tags: ['string'],
			})
		})

		it('should return all questions if the requesting user is allowed to take the conversation', async () => {
			const { body, status } = await fetch({
				method: 'get',
				url: `conversations/${conversations.quiz.id}/questions`,
				headers: {
					authorization: tokens.bofh.bearer,
				},
			})

			expect(status).toEqual(200)
			expect(body.questions.length).toEqual(2)
			expect(body.questions).toMatchShapeOf({
				id: 'string',
				text: 'string',
				options: [
					{
						position: 1,
						type: 'string',
						text: 'string',
						attribute: {
							id: 'string',
							value: 1,
						},
					},
				],
				first: true,
				last: false,
				randomizeOptionOrder: true,
				tags: ['string'],
			})
		})

		it('should return a `not-allowed` error if the requesting user is not allowed to take the conversation', async () => {
			const error = await fetchError({
				method: 'get',
				url: `conversations/${conversations.updates.id}/questions`,
				headers: {
					authorization: tokens.pfy.bearer,
				},
			})

			expect(error?.status).toEqual(403)
			expect(error?.code).toEqual('not-allowed')
		})
	})

	describe('get /conversations/{conversationId}/questions/{questionId}', () => {
		it('should return a `entity-not-found` error when the requested question is not found', async () => {
			const error = await fetchError({
				method: 'get',
				url: `conversations/${conversations.quiz.id}/questions/weird`,
				headers: {
					authorization: tokens.groot.bearer,
				},
			})

			expect(error?.status).toEqual(404)
			expect(error?.code).toEqual('entity-not-found')
		})

		it('should return the requested question when requesting user is allowed to take the conversation', async () => {
			const { body, status } = await fetch({
				method: 'get',
				url: `conversations/${conversations.quiz.id}/questions/${questions.cleanest.id}`,
				headers: {
					authorization: tokens.bofh.bearer,
				},
			})

			expect(status).toEqual(200)
			expect(body.question).toMatchShapeOf({
				id: 'string',
				text: 'string',
				options: [
					{
						position: 1,
						type: 'string',
						text: 'string',
						attribute: {
							id: 'string',
							value: 1,
						},
					},
				],
				first: true,
				last: false,
				randomizeOptionOrder: true,
				tags: ['string'],
			})
		})

		it('should return the requested question when requesting user is groot', async () => {
			const { body, status } = await fetch({
				method: 'get',
				url: `conversations/${conversations.quiz.id}/questions/${questions.capital.id}`,
				headers: {
					authorization: tokens.groot.bearer,
				},
			})

			expect(status).toEqual(200)
			expect(body.question).toMatchShapeOf({
				id: 'string',
				text: 'string',
				options: [
					{
						position: 1,
						type: 'string',
						text: 'string',
						attribute: {
							id: 'string',
							value: 1,
						},
					},
				],
				first: true,
				last: false,
				randomizeOptionOrder: true,
				tags: ['string'],
			})
		})
	})

	describe('delete /conversations/{conversationId}/questions/{questionId}', () => {
		// FIXME: Known issue: even if the document does not exist, Firebase just returns a successful response
		it.skip('should return a `entity-not-found` error when the requested question is not found', async () => {
			const error = await fetchError({
				method: 'delete',
				url: `conversations/${conversations.quiz.id}/questions/weird`,
				headers: {
					authorization: tokens.groot.bearer,
				},
			})

			expect(error?.status).toEqual(404)
			expect(error?.code).toEqual('entity-not-found')
		})

		it('should return a `not-allowed` error when the requesting user is not groot', async () => {
			const error = await fetchError({
				method: 'delete',
				url: `conversations/${conversations.quiz.id}/questions/${questions.cleanest.id}`,
				headers: {
					authorization: tokens.pfy.bearer,
				},
			})

			expect(error?.status).toEqual(403)
			expect(error?.code).toEqual('not-allowed')
		})

		it('should delete the specified question when requesting user is groot', async () => {
			const { status } = await fetch({
				method: 'delete',
				url: `conversations/${conversations.quiz.id}/questions/${questions.cleanest.id}`,
				headers: {
					authorization: tokens.groot.bearer,
				},
			})

			expect(status).toEqual(204)
		})
	})
})
