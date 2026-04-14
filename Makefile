KEYSTONE_DIR       := third_party/keystone
KEYSTONE_LIB       := $(KEYSTONE_DIR)/build/llvm/lib/libkeystone.a
KEYSTONE_NATIVE_LIB := $(KEYSTONE_DIR)/build-native/llvm/lib/libkeystone.a
ASSETS_DIR    := wasmasm/src/assets
TMP_JS        := /tmp/wasmasm.js
TMP_WASM      := /tmp/wasmasm.wasm
TEST_BIN      := tests/run_tests

EMCC_FLAGS := \
	-O3 \
	-s WASM=1 \
	-s EXPORTED_RUNTIME_METHODS='["cwrap","stringToUTF8","UTF8ToString"]' \
	-s EXPORTED_FUNCTIONS='["_assemble","_malloc","_free"]' \
	-s ENVIRONMENT='web' \
	-s EXPORT_ES6=1 \
	-s MODULARIZE=1

.PHONY: all build keystone npm-install vue-build test clean distclean

all: build

## Full build: compile wasm + vue bundle
build: $(ASSETS_DIR)/wasmasm.js $(ASSETS_DIR)/wasmasm.wasm
	$(MAKE) vue-build

## Emscripten compile step — depends on keystone library and C source
$(ASSETS_DIR)/wasmasm.js $(ASSETS_DIR)/wasmasm.wasm: wasmasm.c $(KEYSTONE_LIB) | $(ASSETS_DIR) wasmasm/node_modules
	emcc $(EMCC_FLAGS) \
		-I $(KEYSTONE_DIR)/include \
		-L $(KEYSTONE_DIR)/build/llvm/lib \
		$(KEYSTONE_LIB) \
		wasmasm.c \
		-lkeystone \
		-o $(TMP_JS)
	@printf '/* eslint-disable */\n' > $(ASSETS_DIR)/wasmasm.js
	@cat $(TMP_JS) >> $(ASSETS_DIR)/wasmasm.js
	@rm -f $(TMP_JS)
	@mv $(TMP_WASM) $(ASSETS_DIR)/wasmasm.wasm
	@echo "Assets written to $(ASSETS_DIR)"

## Build keystone static library via cmake
keystone: $(KEYSTONE_LIB)

$(KEYSTONE_LIB):
	@echo "Building keystone with Emscripten..."
	mkdir -p $(KEYSTONE_DIR)/build
	cd $(KEYSTONE_DIR)/build && emcmake cmake .. \
		-DCMAKE_BUILD_TYPE=Release \
		-DBUILD_SHARED_LIBS=OFF \
		-DLLVM_TARGETS_TO_BUILD="all" \
		-G "Unix Makefiles"
	emmake $(MAKE) -C $(KEYSTONE_DIR)/build -j$(shell nproc 2>/dev/null || echo 4)

## Install Vue/npm dependencies
npm-install: wasmasm/node_modules

wasmasm/node_modules: wasmasm/package.json
	cd wasmasm && npm install
	@touch wasmasm/node_modules  # update mtime so make doesn't re-run

## Run the Vue CLI production build
vue-build: wasmasm/node_modules
	cd wasmasm && npm run build

## Start the Vue dev server
serve: wasmasm/node_modules
	cd wasmasm && npm run serve

## Native keystone build used only by the test target (g++, not emcc)
$(KEYSTONE_NATIVE_LIB):
	@echo "Building keystone natively for tests..."
	mkdir -p $(KEYSTONE_DIR)/build-native
	cd $(KEYSTONE_DIR)/build-native && cmake .. \
		-DCMAKE_BUILD_TYPE=Release \
		-DBUILD_SHARED_LIBS=OFF \
		-DLLVM_TARGETS_TO_BUILD="all" \
		-G "Unix Makefiles"
	$(MAKE) -C $(KEYSTONE_DIR)/build-native -j$(shell nproc 2>/dev/null || echo 4)

## Compile and run the native test suite against wasmasm.c
## Uses a stub emscripten.h so the code builds without Emscripten installed.
test: $(KEYSTONE_NATIVE_LIB)
	g++ -o $(TEST_BIN) \
		-I $(KEYSTONE_DIR)/include \
		-I tests \
		wasmasm.c \
		tests/test_wasmasm.c \
		$(KEYSTONE_NATIVE_LIB)
	./$(TEST_BIN)

## Remove generated assets, Vue dist, and test binary
clean:
	rm -f $(ASSETS_DIR)/wasmasm.js $(ASSETS_DIR)/wasmasm.wasm
	rm -rf wasmasm/dist
	rm -f $(TMP_JS) $(TMP_WASM)
	rm -f $(TEST_BIN)

## Remove everything including the keystone builds and node_modules
distclean: clean
	rm -rf $(KEYSTONE_DIR)/build
	rm -rf $(KEYSTONE_DIR)/build-native
	rm -rf wasmasm/node_modules

$(ASSETS_DIR):
	mkdir -p $(ASSETS_DIR)
