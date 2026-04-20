.PHONY: all build test test-unit test-e2e

all: test build

build:
	npm run build

test: test-unit test-e2e

test-unit:
	npm test

test-e2e:
	npm run test:e2e
