.PHONY: all build dev test test-unit test-e2e

all: test build

dev:
	npm run dev

build:
	npm run build

test: test-unit test-e2e

test-unit:
	npm test

test-e2e:
	npm run test:e2e
