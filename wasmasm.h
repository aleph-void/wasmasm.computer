#ifndef WASMASM_H
#define WASMASM_H

int assemble(char *input, int input_size, char *isa, int endianness,
             int word_size, char *output);

int disassemble(char *input, int input_size, char *isa, int endianness,
                int word_size, char *output);

#endif /* WASMASM_H */
