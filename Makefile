.PHONY: launch
launch: shutdown
	yarn codegen
	yarn build
	docker-compose up -d
	docker-compose logs -f

.PHONY: launch-kusama
launch-kusama: shutdown
	yarn codegen
	yarn build
	MANIFEST_FILE=kusama.yaml docker-compose up -d
	docker-compose logs -f

.PHONY: launch-polkadot
launch-polkadot: shutdown
	yarn codegen
	yarn build
	MANIFEST_FILE=polkadot.yaml docker-compose up -d
	docker-compose logs -f

.PHONY: shutdown
shutdown:
	docker-compose down --remove-orphans
	sudo rm -fr .data
