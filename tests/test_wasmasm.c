#include <stdio.h>
#include <string.h>

/*
 * assemble() is defined in wasmasm.c, compiled alongside this file.
 * Expected byte values come from keystone's own regression suite:
 * keystone/suite/regress/test_all_archs.py
 */
int assemble(char *input, int input_size, char *isa, int endianness,
             int word_size, char *output);

#define OUTPUT_SIZE 256

static int pass_count = 0;
static int fail_count = 0;

static void check_ret(const char *name, int got, int expected)
{
    if (got == expected) {
        printf("  PASS: %s\n", name);
        pass_count++;
    } else {
        printf("  FAIL: %s — expected return %d, got %d\n", name, expected, got);
        fail_count++;
    }
}

static void check_output(const char *name, int ret, const char *got,
                          const char *expected)
{
    if (ret != 0) {
        printf("  FAIL: %s — assemble() returned %d\n", name, ret);
        fail_count++;
    } else if (strcmp(got, expected) != 0) {
        printf("  FAIL: %s\n    expected \"%s\"\n    got     \"%s\"\n",
               name, expected, got);
        fail_count++;
    } else {
        printf("  PASS: %s\n", name);
        pass_count++;
    }
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

#define RUN_ERR(desc, input, isa, end, ws) \
    do { \
        char _o[OUTPUT_SIZE]; \
        memset(_o, 0, OUTPUT_SIZE); \
        int _r = assemble((char *)(input), (int)strlen(input), (char *)(isa), \
                          (end), (ws), _o); \
        check_ret(desc, _r, -1); \
    } while (0)

#define RUN_OK(desc, input, isa, end, ws, expected_bytes) \
    do { \
        char _o[OUTPUT_SIZE]; \
        memset(_o, 0, OUTPUT_SIZE); \
        int _r = assemble((char *)(input), (int)strlen(input), (char *)(isa), \
                          (end), (ws), _o); \
        check_output(desc, _r, _o, expected_bytes); \
    } while (0)

/* ── test groups ─────────────────────────────────────────────────────────── */

static void test_error_paths(void)
{
    printf("=== Error path tests ===\n");

    RUN_ERR("reject unknown ISA",
            "nop", "invalid_isa", 0, 32);

    RUN_ERR("reject aarch64 with word_size=32",
            "nop", "aarch64", 0, 32);

    RUN_ERR("reject aarch64 with word_size=16",
            "nop", "aarch64", 0, 16);

    RUN_ERR("reject arm with word_size=64 (use aarch64 instead)",
            "nop", "arm", 0, 64);

    RUN_ERR("reject unsupported word_size=8",
            "nop", "x86", 0, 8);

    RUN_ERR("reject invalid assembly input",
            "@@not_an_instruction@@", "x86", 0, 32);
}

static void test_x86(void)
{
    printf("\n=== x86 tests ===\n");

    /* operand-size prefix (0x66) added in 16-bit mode for 32-bit registers */
    RUN_OK("x86 16-bit: add eax, ecx",
           "add eax, ecx", "x86", 0, 16, "66 01 c8 ");

    RUN_OK("x86 32-bit: add eax, ecx",
           "add eax, ecx", "x86", 0, 32, "01 c8 ");

    /* REX.W prefix (0x48) required for 64-bit operands */
    RUN_OK("x86 64-bit: add rax, rcx",
           "add rax, rcx", "x86", 0, 64, "48 01 c8 ");
}

static void test_arm(void)
{
    printf("\n=== ARM tests ===\n");

    /* ARM32 little-endian: sub r1, r2, r5 → e0421005 → LE bytes 05 10 42 e0 */
    RUN_OK("arm 32-bit little-endian: sub r1, r2, r5",
           "sub r1, r2, r5", "arm", 0, 32, "05 10 42 e0 ");

    /* Same instruction big-endian */
    RUN_OK("arm 32-bit big-endian: sub r1, r2, r5",
           "sub r1, r2, r5", "arm", 1, 32, "e0 42 10 05 ");

    /* Thumb (16-bit) */
    RUN_OK("arm Thumb: movs r4, #0xf0",
           "movs r4, #0xf0", "arm", 0, 16, "f0 24 ");
}

static void test_aarch64(void)
{
    printf("\n=== AArch64 tests ===\n");

    /* ldr w1, [sp, #8] → b9400be1 → LE bytes e1 0b 40 b9 */
    RUN_OK("aarch64: ldr w1, [sp, #0x8]",
           "ldr w1, [sp, #0x8]", "aarch64", 0, 64, "e1 0b 40 b9 ");
}

static void test_mips(void)
{
    printf("\n=== MIPS tests ===\n");

    /* and $9,$6,$7 → 00c74824 → LE bytes 24 48 c7 00 */
    RUN_OK("mips 32-bit little-endian: and $9, $6, $7",
           "and $9, $6, $7", "mips", 0, 32, "24 48 c7 00 ");

    /* same instruction, big-endian */
    RUN_OK("mips 32-bit big-endian: and $9, $6, $7",
           "and $9, $6, $7", "mips", 1, 32, "00 c7 48 24 ");

    /* 64-bit MIPS — just verify it assembles */
    RUN_OK("mips 64-bit little-endian: and $9, $6, $7",
           "and $9, $6, $7", "mips", 0, 64, "24 48 c7 00 ");
}

static void test_sparc(void)
{
    printf("\n=== SPARC tests ===\n");

    /* add %g1,%g2,%g3 big-endian → 86004002 → bytes 86 00 40 02 */
    RUN_OK("sparc 32-bit big-endian: add %g1, %g2, %g3",
           "add %g1, %g2, %g3", "sparc", 1, 32, "86 00 40 02 ");
}

/* ── entry point ─────────────────────────────────────────────────────────── */

int main(void)
{
    test_error_paths();
    test_x86();
    test_arm();
    test_aarch64();
    test_mips();
    test_sparc();

    printf("\n=== Results: %d passed, %d failed ===\n", pass_count, fail_count);
    return fail_count > 0 ? 1 : 0;
}
