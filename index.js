
const calleeSaved = [
  "ra",
  "s0",
  "s1",
  "s2",
  "s3",
  "s4",
  "s5",
  "s6",
  "s7",
  "gp",
  "sp",
  "fp",
];

const state = {
  argCount: 0,
  localDataWords: 0,
  regs: {
    at: false,
    v0: false,
    v1: false,
    a0: false,
    a1: false,
    a2: false,
    a3: false,
    t0: false,
    t1: false,
    t2: false,
    t3: false,
    t4: false,
    t5: false,
    t6: false,
    t7: false,
    t8: false,
    t9: false,
    s0: false,
    s1: false,
    s2: false,
    s3: false,
    s4: false,
    s5: false,
    s6: false,
    s7: false,
    // k0: false,
    // k1: false,
    gp: false,
    sp: false,
    fp: false,
    ra: true,
  }
}

new Vue({
  el: "#app",
  data: state,
  computed: {
    assembly: updateAssembly,
    savedRegisterCount: function() {
      let count = 0;
      for (let reg of calleeSaved) {
        if (this.regs[reg]) {
          count++;
        }
      }
      return count;
    }
  },
});

function updateAssembly() {
  const argumentSectionSize = this.argCount * 4;
  const savedRegSectionSize = this.savedRegisterCount * 4;
  const localDataSectionSize = this.localDataWords * 4;

  const hasSomeLowerSections = !!argumentSectionSize || !!savedRegSectionSize;
  const lowerSectionsDivBy8 = !!((argumentSectionSize + savedRegSectionSize) % 8);
  const padSize = (hasSomeLowerSections && lowerSectionsDivBy8) ? 4 : 0;

  const stackSize = argumentSectionSize + savedRegSectionSize + padSize + localDataSectionSize;

  let asm = "";

  if (stackSize > 0) {
    const padText = padSize ? " ; Including 4 byte pad" : "";
    asm += `ADDIU SP SP -${stackSize}${padText}\n`;
  }

  const usingRA = this.regs["ra"];
  const raStackOffset = (argumentSectionSize + savedRegSectionSize - 4);
  if (usingRA)
    asm += `SW RA ${raStackOffset}(SP)\n`

  if (this.regs["a0"] || this.regs["a1"] || this.regs["a2"] || this.regs["a3"]) {
    let wroteComment = false;
    for (let i = 0; i < Math.min(4, this.argCount); i++) {
      if (this.regs[`a${i}`]) {
        if (!wroteComment) {
          asm += "\n; Save off argument registers:\n";
          wroteComment = true;
        }
        asm += `SW A${i} ${i * 4}(SP)\n`;
      }
    }
  }

  if (this.argCount > 4) {
    asm += "\n; Access additional arguments:\n";
    asm += `LW reg 16(SP) ; arg4\n`;

    if (this.argCount > 6) {
      asm += "...\n";
      asm += `LW reg ${(this.argCount - 1) * 4}(SP) ; arg${this.argCount - 1}\n`;
    }
    else if (this.argCount === 6) {
      asm += `LW reg 20(SP) ; arg5\n`;
    }
  }

  if ((!usingRA && this.savedRegisterCount) || (usingRA && this.savedRegisterCount > 1)) {
    asm += "\n; Save registers:\n";
    let currentReg = 0;
    for (let i = 1; i < calleeSaved.length; i++) {
      const reg = calleeSaved[i];
      if (this.regs[reg]) {
        const spOffset = argumentSectionSize + (currentReg * 4);
        asm += `SW ${reg.toUpperCase()} ${spOffset}(SP)\n`;
        currentReg++;
      }
    }
  }

  if (this.localDataWords) {
    asm += "\n; Access local data:\n";

    let localStackOffset = argumentSectionSize + savedRegSectionSize + padSize;

    asm += `LW reg ${localStackOffset}(SP) ; local0\n`;

    if (this.localDataWords > 2) {
      asm += "...\n";
      const lastLocalOffset = localStackOffset + ((this.localDataWords - 1) * 4);
      asm += `LW reg ${lastLocalOffset}(SP) ; local${this.localDataWords - 1}\n`;
    }
    else if (this.localDataWords === 2) {
      asm += `LW reg ${localStackOffset + 4}(SP) ; local1\n`;
    }
  }

  if (usingRA)
    asm += `\nLW RA ${raStackOffset}(SP)\n`;
  else
    asm += "\n";

  asm += "JR RA\n";

  if (stackSize > 0)
    asm += `ADDIU SP SP ${stackSize}`;
  else
    asm += "NOP";

  return asm.trim();
}
