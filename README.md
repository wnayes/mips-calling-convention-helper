MIPS Calling Convention Helper
==============================

Visualizer that helps construct a valid MIPS function.

For example, if you need to write a function that takes 2 arguments, has 16 bytes of stack memory, and uses `$s0`, `$s1`, and `$ra`, the following will be generated:

    ADDIU SP SP -40 ; Including 4 byte pad
    SW RA 16(SP)

    ; Save off argument registers:
    SW A0 0(SP)
    SW A1 4(SP)

    ; Save registers:
    SW S0 8(SP)
    SW S1 12(SP)

    ; Access local data:
    LW reg 24(SP) ; local0
    ...
    LW reg 36(SP) ; local3

    LW RA 16(SP)
    JR RA
    ADDIU SP SP 40

Usage
-----

The visualizer is a simple HTML page hosted in this repository.

About
-----

This was made, in part, as a quick experiment with the Vue library.

License
-------

MIT