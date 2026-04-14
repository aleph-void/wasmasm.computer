#include "emscripten.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <inttypes.h>
#include <ctype.h>
#include <keystone/keystone.h>
#include <capstone/capstone.h>

EMSCRIPTEN_KEEPALIVE
int assemble(char *input, int input_size, char *isa, int endianness, int word_size, char *output) {
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

      err = ks_open((ks_arch)_isa, mode, &ks);
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

      ks_free(encode);
      ks_close(ks);

      return 0;
}

/* Parse a hex string like "90 48 8b 05" into raw bytes.
   Accepts space/comma/tab separators and optional 0x prefixes.
   Caller must free() the returned buffer.
   Returns byte count on success, -1 on parse error. */
static int parse_hex(const char *hex, unsigned char **out) {
    size_t len = strlen(hex);
    unsigned char *buf = (unsigned char *)malloc(len / 2 + 1);
    if (!buf) return -1;
    int n = 0;
    const char *p = hex;
    while (*p) {
        /* skip separators */
        while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r' || *p == ',') p++;
        if (!*p) break;
        /* optional 0x / 0X prefix */
        if (p[0] == '0' && (p[1] == 'x' || p[1] == 'X')) p += 2;
        if (!isxdigit((unsigned char)p[0]) || !isxdigit((unsigned char)p[1])) {
            free(buf);
            return -1;
        }
        unsigned int hi, lo;
        char c = p[0];
        hi = (c >= '0' && c <= '9') ? (unsigned)(c - '0') :
             (c >= 'a' && c <= 'f') ? (unsigned)(c - 'a' + 10) : (unsigned)(c - 'A' + 10);
        c = p[1];
        lo = (c >= '0' && c <= '9') ? (unsigned)(c - '0') :
             (c >= 'a' && c <= 'f') ? (unsigned)(c - 'a' + 10) : (unsigned)(c - 'A' + 10);
        buf[n++] = (unsigned char)((hi << 4) | lo);
        p += 2;
    }
    *out = buf;
    return n;
}

EMSCRIPTEN_KEEPALIVE
int disassemble(char *input, int input_size, char *isa, int endianness, int word_size, char *output) {
    csh cs;
    cs_insn *insn;
    size_t count;
    cs_arch _isa = CS_ARCH_X86;
    int mode = 0;

    /* parse hex input into raw bytes */
    unsigned char *bytes;
    int nbytes = parse_hex(input, &bytes);
    if (nbytes <= 0) {
        printf("ERROR: failed to parse hex input\n");
        return -1;
    }

    /* select architecture */
    if (strcmp("arm", isa) == 0) {
        _isa = CS_ARCH_ARM;
    } else if (strcmp("aarch64", isa) == 0) {
        _isa = CS_ARCH_AARCH64;
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
        free(bytes);
        return -1;
    }

    /* select mode */
    if (strcmp("aarch64", isa) == 0) {
        if (word_size != 64) {
            printf("ERROR: AArch64 only supports 64-bit word size\n");
            free(bytes);
            return -1;
        }
        mode = CS_MODE_LITTLE_ENDIAN;
    } else if (strcmp("arm", isa) == 0) {
        if (word_size == 16) {
            mode = CS_MODE_THUMB;
        } else if (word_size == 32) {
            mode = CS_MODE_ARM;
        } else {
            printf("ERROR: ARM supports 16-bit (Thumb) or 32-bit word size only\n");
            free(bytes);
            return -1;
        }
    } else if (strcmp("mips", isa) == 0) {
        if (word_size == 32) {
            mode = CS_MODE_MIPS32;
        } else if (word_size == 64) {
            mode = CS_MODE_MIPS64;
        } else {
            printf("ERROR: MIPS supports 32 or 64-bit word size only\n");
            free(bytes);
            return -1;
        }
    } else if (strcmp("sparc", isa) == 0) {
        /* Capstone requires big-endian mode for SPARC */
        mode = CS_MODE_BIG_ENDIAN;
    } else {
        /* x86, ppc */
        if (word_size == 16) {
            mode = CS_MODE_16;
        } else if (word_size == 32) {
            mode = CS_MODE_32;
        } else if (word_size == 64) {
            mode = CS_MODE_64;
        } else {
            printf("ERROR: Incorrect Word Size!\n");
            free(bytes);
            return -1;
        }
    }

    /* apply endianness where not fixed by the architecture */
    if (strcmp("x86", isa) != 0 && strcmp("sparc", isa) != 0) {
        if (endianness == 1) {
            mode |= CS_MODE_BIG_ENDIAN;
        }
    }

    if (cs_open(_isa, (cs_mode)mode, &cs) != CS_ERR_OK) {
        printf("ERROR: failed on cs_open()\n");
        free(bytes);
        return -1;
    }

    count = cs_disasm(cs, bytes, (size_t)nbytes, 0, 0, &insn);
    free(bytes);

    if (count == 0) {
        printf("ERROR: cs_disasm() failed — check bytes, ISA, and settings\n");
        cs_close(&cs);
        return -1;
    }

    int len = 0;
    for (size_t i = 0; i < count; i++) {
        len += sprintf(output + len, "0x%04" PRIx64 ":  %-10s %s\n",
                       insn[i].address, insn[i].mnemonic, insn[i].op_str);
    }

    cs_free(insn, count);
    cs_close(&cs);

    return 0;
}
