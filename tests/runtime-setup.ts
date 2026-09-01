export {};

jest.setTimeout(30000);

const prisma = require('../src/db/prisma/client').default;

afterAll(async () => {
	await prisma.$disconnect();
});

const originalFetch = global.fetch;
const supabaseAuthRequestPattern = /\/auth\/v1(?:\/|$)/;
const authRetryCount = 2;
const authRequestTimeoutMs = 10000;

global.fetch = async (input, init) => {
	const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
	if (!supabaseAuthRequestPattern.test(requestUrl)) {
		return originalFetch(input, init);
	}

	let lastError: unknown;
	for (let attempt = 0; attempt <= authRetryCount; attempt += 1) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), authRequestTimeoutMs);
		const requestInit = { ...init, signal: init?.signal ?? controller.signal };

		try {
			const response = await originalFetch(input, requestInit);
			if (response.status < 500 || attempt === authRetryCount) return response;
		} catch (error) {
			lastError = error;
			if (attempt === authRetryCount) throw error;
		} finally {
			clearTimeout(timeout);
		}

		await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
	}

	throw lastError;
};