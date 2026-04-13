#include "emscripten.h"
#include <stdio.h>
#include <keystone/keystone.h>
#include <string.h>

EMSCRIPTEN_KEEPALIVE
int assemble( char * input, int input_size, char * isa, int endianness, int word_size, char * output) {
      ks_engine *ks;
      ks_err err;
      size_t count;
      unsigned char *encode;
      size_t size;
      int mode = 0;
      int _isa = 0;
      printf("Input: %s\n", input);
      printf("Input Size: %d\n", input_size);
      printf("ISA: %s\n", isa);
      printf("Endianness: %d\n", endianness);
      printf("Wordsize: %d\n", word_size);
      if (strcmp("arm", isa) == 0) {
        _isa = KS_ARCH_ARM;
      } else if (strcmp("aarch64", isa) == 0){
        _isa = KS_ARCH_ARM64;
      }else if (strcmp("x86", isa) == 0) {
        _isa = KS_ARCH_X86;
      } else if (strcmp("ppc", isa) == 0) {
        _isa = KS_ARCH_PPC;
      } else if (strcmp("mips", isa) == 0) {
        _isa = KS_ARCH_MIPS;
      } else if (strcmp("sparc", isa) == 0) {
        _isa = KS_ARCH_SPARC;
      } else {
        printf("ERROR: Incorrect ISA!\n");
        return -1;
      }
    
      // AArch64 is always 64-bit; KS_MODE_64 is an x86-only flag and must
      // never be passed to KS_ARCH_ARM64 — ks_open() returns KS_ERR_MODE.
      if (strcmp("aarch64", isa) == 0) {
        if (word_size != 64) {
          printf("ERROR: AArch64 only supports 64-bit word size\n");
          return -1;
        }
        mode = KS_MODE_LITTLE_ENDIAN; // endianness flag applied below
      } else if (word_size == 16) {
        if (strcmp("arm", isa) == 0) {
          mode = KS_MODE_THUMB;
        } else {
          mode = KS_MODE_16;
        }
      } else if (word_size == 32) {
        if (strcmp("arm", isa) == 0) {
          mode = KS_MODE_ARM;
        } else {
          mode = KS_MODE_32;
        }
      } else if (word_size == 64) {
        // 64-bit ARM requires KS_ARCH_ARM64, not KS_ARCH_ARM
        if (strcmp("arm", isa) == 0) {
          printf("ERROR: 64-bit ARM requires isa 'aarch64', not 'arm'\n");
          return -1;
        }
        mode = KS_MODE_64;
      } else {
        printf("ERROR: Incorrect Word Size!\n");
        return -1;
      }

      if (endianness == 1 && strcmp("x86", isa) != 0) {
        mode = mode + KS_MODE_BIG_ENDIAN;
      } else if (endianness == 2 && strcmp("sparc", isa) == 0){
        mode = mode + KS_MODE_LITTLE_ENDIAN;
      }
  
      err = ks_open(_isa, mode, &ks);
      if (err != KS_ERR_OK) {
          printf("ERROR: failed on ks_open(), quit\n");
          return -1;
      }
  
      if (ks_asm(ks, input, 0, &encode, &size, &count) != KS_ERR_OK) {
          printf("ERROR: ks_asm() failed & count = %lu, error = %u\n",
		         count, ks_errno(ks));
          ks_free(encode);
          ks_close(ks);
          return -1;
      }

      size_t i;
      int len = 0;
      for (i = 0; i < size; i++) {
          sprintf(output + len, "%02x ", encode[i]);
          len += 3;
      }

      // NOTE: free encode after usage to avoid leaking memory
      ks_free(encode);

      // close Keystone instance when done
      ks_close(ks);

      return 0;
}
/*
int disassemble( const unsigned char * input, int input_size, char * isa, int endianness, int word_size, char * output) {
      csh cs;
      cs_insn *insn;
      size_t count;
      unsigned char *encode;
      int mode = 0;
      int _isa = 0;

      if (strcmp("arm", isa) == 0) {
        _isa = CS_ARCH_ARM;
      } else if (strcmp("aarch64", isa) == 0) {
        _isa = CS_ARCH_ARM64;
      } else if (strcmp("x86", isa) == 0) {
        _isa = CS_ARCH_X86;
      } else if (strcmp("ppc", isa) == 0) {
        _isa = CS_ARCH_PPC;
      } else if (strcmp("mips", isa) == 0) {
        _isa = CS_ARCH_MIPS;
      } else if (strcmp("sparc", isa) == 0) {
        _isa = CS_ARCH_SPARC;
      } else {
        printf("ERROR: Incorrect ISA!\n");
        return -1;
      }
    
      if (word_size == 16) {
        mode = CS_MODE_16;
      } else if (word_size == 32) {
        mode = CS_MODE_32;
      } else if (word_size == 64) {
        mode = CS_MODE_64;
      } else {
        printf("ERROR: Incorrect Word Size!\n");
        return -1;
      }

      if (endianness == 1) {
        mode = mode + CS_MODE_BIG_ENDIAN;
      } else if (endianness == 2){
        mode = mode + CS_MODE_LITTLE_ENDIAN;
      }
  
      if (cs_open(_isa, mode, &cs) != CS_ERR_OK) {
          printf("ERROR: failed on cs_open(), quit\n");
          return -1;
      }

      count = cs_disasm(cs, input, input_size, 0, 0, &insn);
      if (count == 0) {
          printf("ERROR: cs_disasm() failed\n");
      } else {
          size_t i;
  
          for (i = 0; i < count; i++) {
              sprintf(output, "0x%"PRIx64":\t%s\t\t%s\n", insn[i].address, insn[i].mnemonic,
					insn[i].op_str);
          }
      }
  
      // NOTE: free encode after usage to avoid leaking memory
      cs_free(insn, count);
  
      // close Capstone instance when done
      cs_close(&cs);
  
      return 0;
}
*/