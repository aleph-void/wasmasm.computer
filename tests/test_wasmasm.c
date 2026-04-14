#include <stdio.h>
#include <string.h>

/*
 * assemble() and disassemble() are defined in wasmasm.c, compiled alongside
 * this file. Expected byte values come from keystone's own regression suite:
 * keystone/suite/regress/test_all_archs.py
 */
int assemble(char *input, int input_size, char *isa, int endianness,
             int word_size, char *output);

int disassemble(char *input, int input_size, char *isa, int endianness,
                int word_size, char *output);

#define OUTPUT_SIZE 1024

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
        printf("  FAIL: %s — function returned %d\n", name, ret);
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

/* check that the output contains the given substring */
static void check_contains(const char *name, int ret, const char *got,
                            const char *needle)
{
    if (ret != 0) {
        printf("  FAIL: %s — function returned %d\n", name, ret);
        fail_count++;
    } else if (strstr(got, needle) == NULL) {
        printf("  FAIL: %s\n    expected to contain \"%s\"\n    got \"%s\"\n",
               name, needle, got);
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

#define DISASM_ERR(desc, input, isa, end, ws) \
    do { \
        char _o[OUTPUT_SIZE]; \
        memset(_o, 0, OUTPUT_SIZE); \
        int _r = disassemble((char *)(input), (int)strlen(input), \
                             (char *)(isa), (end), (ws), _o); \
        check_ret(desc, _r, -1); \
    } while (0)

#define DISASM_CONTAINS(desc, input, isa, end, ws, needle) \
    do { \
        char _o[OUTPUT_SIZE]; \
        memset(_o, 0, OUTPUT_SIZE); \
        int _r = disassemble((char *)(input), (int)strlen(input), \
                             (char *)(isa), (end), (ws), _o); \
        check_contains(desc, _r, _o, needle); \
    } while (0)

/* ── assemble: error paths ───────────────────────────────────────────────── */

static void test_assemble_error_paths(void)
{
    printf("=== Assemble: error path tests ===\n");

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

/* ── assemble: x86 ───────────────────────────────────────────────────────── */

static void test_assemble_x86(void)
{
    printf("\n=== Assemble: x86 tests ===\n");

    /* operand-size prefix (0x66) added in 16-bit mode for 32-bit registers */
    RUN_OK("x86 16-bit: add eax, ecx",
           "add eax, ecx", "x86", 0, 16, "66 01 c8 ");

    RUN_OK("x86 32-bit: add eax, ecx",
           "add eax, ecx", "x86", 0, 32, "01 c8 ");

    /* REX.W prefix (0x48) required for 64-bit operands */
    RUN_OK("x86 64-bit: add rax, rcx",
           "add rax, rcx", "x86", 0, 64, "48 01 c8 ");
}

/* ── assemble: ARM ───────────────────────────────────────────────────────── */

static void test_assemble_arm(void)
{
    printf("\n=== Assemble: ARM tests ===\n");

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

/* ── assemble: AArch64 ───────────────────────────────────────────────────── */

static void test_assemble_aarch64(void)
{
    printf("\n=== Assemble: AArch64 tests ===\n");

    /* ldr w1, [sp, #8] → b9400be1 → LE bytes e1 0b 40 b9 */
    RUN_OK("aarch64: ldr w1, [sp, #0x8]",
           "ldr w1, [sp, #0x8]", "aarch64", 0, 64, "e1 0b 40 b9 ");
}

/* ── assemble: MIPS ──────────────────────────────────────────────────────── */

static void test_assemble_mips(void)
{
    printf("\n=== Assemble: MIPS tests ===\n");

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

/* ── assemble: SPARC ─────────────────────────────────────────────────────── */

static void test_assemble_sparc(void)
{
    printf("\n=== Assemble: SPARC tests ===\n");

    /* add %g1,%g2,%g3 big-endian → 86004002 → bytes 86 00 40 02 */
    RUN_OK("sparc 32-bit big-endian: add %g1, %g2, %g3",
           "add %g1, %g2, %g3", "sparc", 1, 32, "86 00 40 02 ");
}

/* ── disassemble: error paths ────────────────────────────────────────────── */

static void test_disassemble_error_paths(void)
{
    printf("\n=== Disassemble: error path tests ===\n");

    DISASM_ERR("reject unknown ISA",
               "90", "invalid_isa", 0, 32);

    DISASM_ERR("reject aarch64 with word_size=32",
               "e1 0b 40 b9", "aarch64", 0, 32);

    DISASM_ERR("reject ARM with word_size=64",
               "05 10 42 e0", "arm", 0, 64);

    DISASM_ERR("reject invalid hex input",
               "ZZ ZZ", "x86", 0, 32);

    DISASM_ERR("reject empty input",
               "", "x86", 0, 32);
}

/* ── disassemble: x86 ────────────────────────────────────────────────────── */

static void test_disassemble_x86(void)
{
    printf("\n=== Disassemble: x86 tests ===\n");

    /* 01 c8 = add eax, ecx (32-bit) */
    DISASM_CONTAINS("x86 32-bit: 01 c8 → add eax, ecx",
                    "01 c8", "x86", 2, 32, "add");

    /* 48 01 c8 = add rax, rcx (64-bit, REX.W prefix) */
    DISASM_CONTAINS("x86 64-bit: 48 01 c8 → add rax, rcx",
                    "48 01 c8", "x86", 2, 64, "add");

    /* 66 01 c8 = add eax, ecx (16-bit mode with operand-size prefix) */
    DISASM_CONTAINS("x86 16-bit: 66 01 c8 → contains add",
                    "66 01 c8", "x86", 2, 16, "add");

    /* 90 = nop */
    DISASM_CONTAINS("x86 32-bit: 90 → nop",
                    "90", "x86", 2, 32, "nop");
}

/* ── disassemble: ARM ────────────────────────────────────────────────────── */

static void test_disassemble_arm(void)
{
    printf("\n=== Disassemble: ARM tests ===\n");

    /* 05 10 42 e0 = sub r1, r2, r5 (ARM32 LE) */
    DISASM_CONTAINS("arm 32-bit little-endian: 05 10 42 e0 → sub",
                    "05 10 42 e0", "arm", 2, 32, "sub");

    /* e0 42 10 05 = sub r1, r2, r5 (ARM32 BE) */
    DISASM_CONTAINS("arm 32-bit big-endian: e0 42 10 05 → sub",
                    "e0 42 10 05", "arm", 1, 32, "sub");

    /* f0 24 = movs r4, #0xf0 (Thumb) */
    DISASM_CONTAINS("arm Thumb 16-bit: f0 24 → movs",
                    "f0 24", "arm", 2, 16, "movs");
}

/* ── disassemble: AArch64 ────────────────────────────────────────────────── */

static void test_disassemble_aarch64(void)
{
    printf("\n=== Disassemble: AArch64 tests ===\n");

    /* e1 0b 40 b9 = ldr w1, [sp, #8] */
    DISASM_CONTAINS("aarch64: e1 0b 40 b9 → ldr",
                    "e1 0b 40 b9", "aarch64", 2, 64, "ldr");
}

/* ── disassemble: MIPS ───────────────────────────────────────────────────── */

static void test_disassemble_mips(void)
{
    printf("\n=== Disassemble: MIPS tests ===\n");

    /* 24 48 c7 00 = and $9, $6, $7 (MIPS32 LE) */
    DISASM_CONTAINS("mips 32-bit little-endian: 24 48 c7 00 → and",
                    "24 48 c7 00", "mips", 2, 32, "and");

    /* 00 c7 48 24 = and $9, $6, $7 (MIPS32 BE) */
    DISASM_CONTAINS("mips 32-bit big-endian: 00 c7 48 24 → and",
                    "00 c7 48 24", "mips", 1, 32, "and");
}

/* ── disassemble: output format ──────────────────────────────────────────── */

static void test_disassemble_output_format(void)
{
    printf("\n=== Disassemble: output format tests ===\n");

    /* Output should contain a hex address prefix like "0x0000:" */
    DISASM_CONTAINS("output includes address prefix",
                    "90", "x86", 2, 32, "0x");

    /* Multiple instructions should each appear on their own line */
    char out[OUTPUT_SIZE];
    memset(out, 0, OUTPUT_SIZE);
    int ret = disassemble((char *)"90 90", (int)strlen("90 90"),
                          (char *)"x86", 2, 32, out);
    if (ret == 0) {
        /* Two nops → two newlines */
        int newlines = 0;
        for (const char *p = out; *p; p++) {
            if (*p == '\n') newlines++;
        }
        if (newlines >= 2) {
            printf("  PASS: multiple instructions produce multiple lines\n");
            pass_count++;
        } else {
            printf("  FAIL: multiple instructions produce multiple lines — got %d newlines in \"%s\"\n",
                   newlines, out);
            fail_count++;
        }
    } else {
        printf("  FAIL: multiple instructions produce multiple lines — disassemble returned %d\n", ret);
        fail_count++;
    }
}

/* ── round-trip tests ────────────────────────────────────────────────────── */

static void test_roundtrip(void)
{
    printf("\n=== Round-trip tests (assemble then disassemble) ===\n");

    /* Assemble x86 32-bit add eax, ecx → "01 c8 ", then disassemble it back */
    {
        char asm_out[OUTPUT_SIZE];
        memset(asm_out, 0, OUTPUT_SIZE);
        int r = assemble((char *)"add eax, ecx", 12, (char *)"x86", 2, 32, asm_out);
        if (r != 0) {
            printf("  FAIL: round-trip x86 add — assemble step failed\n");
            fail_count++;
        } else {
            char dis_out[OUTPUT_SIZE];
            memset(dis_out, 0, OUTPUT_SIZE);
            r = disassemble(asm_out, (int)strlen(asm_out), (char *)"x86", 2, 32, dis_out);
            check_contains("round-trip x86: add eax, ecx", r, dis_out, "add");
        }
    }

    /* Assemble ARM32 LE sub r1, r2, r5 → "05 10 42 e0 ", then disassemble */
    {
        char asm_out[OUTPUT_SIZE];
        memset(asm_out, 0, OUTPUT_SIZE);
        int r = assemble((char *)"sub r1, r2, r5", 14, (char *)"arm", 2, 32, asm_out);
        if (r != 0) {
            printf("  FAIL: round-trip arm sub — assemble step failed\n");
            fail_count++;
        } else {
            char dis_out[OUTPUT_SIZE];
            memset(dis_out, 0, OUTPUT_SIZE);
            r = disassemble(asm_out, (int)strlen(asm_out), (char *)"arm", 2, 32, dis_out);
            check_contains("round-trip arm: sub r1, r2, r5", r, dis_out, "sub");
        }
    }
}

/* ── entry point ─────────────────────────────────────────────────────────── */

int main(void)
{
    test_assemble_error_paths();
    test_assemble_x86();
    test_assemble_arm();
    test_assemble_aarch64();
    test_assemble_mips();
    test_assemble_sparc();

    test_disassemble_error_paths();
    test_disassemble_x86();
    test_disassemble_arm();
    test_disassemble_aarch64();
    test_disassemble_mips();
    test_disassemble_output_format();

    test_roundtrip();

    printf("\n=== Results: %d passed, %d failed ===\n", pass_count, fail_count);
    return fail_count > 0 ? 1 : 0;
}
