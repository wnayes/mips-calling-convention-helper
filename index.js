/** MIPS registers. */
const regs = [
  "at",
  "v0",
  "v1",
  "a0",
  "a1",
  "a2",
  "a3",
  "t0",
  "t1",
  "t2",
  "t3",
  "t4",
  "t5",
  "t6",
  "t7",
  "t8",
  "t9",
  "s0",
  "s1",
  "s2",
  "s3",
  "s4",
  "s5",
  "s6",
  "s7",
  // "k0",
  // "k1",
  "gp",
  "sp",
  "fp",
  "ra",
];

/** Registers that are saved by the callee by convention. */
const calleeSaved = [
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
  "ra",
];

/** Registers that are saved by the caller by convention. */
const callerSaved = [
  "at",
  "v0",
  "v1",
  "a0",
  "a1",
  "a2",
  "a3",
  "t0",
  "t1",
  "t2",
  "t3",
  "t4",
  "t5",
  "t6",
  "t7",
  "t8",
  "t9",
];

const state = {
  argWords: 0,
  localDataWords: 0,
  includeHelp: true,
  useHexNumbers: false,
  usedRegisters: {},
}

// Initialize all registers as unused, except RA.
for (let reg of regs) {
  state.usedRegisters[reg] = reg === "ra" ? true : false;
}

new Vue({
  el: "#app",
  data: state,
  computed: {
    assembly: updateAssembly,
    savedRegisterCount: function() {
      let count = 0;
      for (let reg of calleeSaved) {
        if (this.usedRegisters[reg]) {
          count++;
        }
      }
      return count;
    },
    savedTempRegisterCount: function() {
      let count = 0;
      for (let reg of callerSaved) {
        if (this.usedRegisters[reg]) {
          count++;
        }
      }
      return count;
    }
  },
});

function updateAssembly() {
  const argWords = Math.max(0, this.argWords);
  const argumentSectionSize = argWords ? Math.max(16, argWords * 4) : 0;
  const savedRegSectionSize = this.savedRegisterCount * 4;
  const savedTempRegSectionSize = this.savedTempRegisterCount * 4;
  const localDataWords = Math.max(0, this.localDataWords);
  const localDataSectionSize = localDataWords * 4;

  const hasSomeLowerSections = !!argumentSectionSize || !!savedRegSectionSize;
  const lowerSectionsDivBy8 = !!((argumentSectionSize + savedRegSectionSize) % 8);
  const lowerPadSize = (hasSomeLowerSections && lowerSectionsDivBy8) ? 4 : 0;

  let stackSize = argumentSectionSize + savedRegSectionSize + lowerPadSize + savedTempRegSectionSize + localDataSectionSize;

  const upperPadSize = (stackSize % 8) ? 4 : 0;
  stackSize += upperPadSize;

  const includeHelp = this.includeHelp;

  const formatNumber = (n) => {
    const numBase = this.useHexNumbers ? 16 : 10;
    if (n && numBase === 16)
      return "0x" + n.toString(16).toUpperCase();
    return n.toString(numBase);
  };

  let asm = "";

  if (stackSize > 0) {
    const totalPad = lowerPadSize + upperPadSize;
    const padText = (totalPad && includeHelp) ? ` ; Including ${totalPad} byte pad` : "";
    asm += `ADDIU SP SP -${formatNumber(stackSize)}${padText}\n`;
  }

  const calleeSavedTopOffset = argumentSectionSize + savedRegSectionSize - 4;
  if (savedRegSectionSize) {
    asm += generateSavedRegisterCode(this.usedRegisters, "SW", calleeSavedTopOffset, calleeSaved, formatNumber);
    asm += "\n";
  }

  if (includeHelp) {
    const beginCodeMessage = "; Begin code\n\n";
    asm += beginCodeMessage;

    const callerSavedTopOffset = argumentSectionSize + savedRegSectionSize + lowerPadSize + savedTempRegSectionSize - 4;
    if (savedTempRegSectionSize) {
      asm += generateSavedRegisterCode(this.usedRegisters, "SW", callerSavedTopOffset, callerSaved, formatNumber);
      asm += "\n";
    }

    if (argWords > 0) {
      asm += "; Using argument storage:\n";
      asm += `SW reg 0(SP) ; arg0\n`;
      if (argWords > 1)
        asm += `SW reg ${formatNumber(4)}(SP) ; arg1\n`;
      if (argWords > 2)
        asm += `SW reg ${formatNumber(8)}(SP) ; arg2\n`;
      if (argWords > 3)
        asm += `SW reg ${formatNumber(12)}(SP) ; arg3\n`;

      if (argWords > 5) {
        asm += "...\n";
        asm += `SW reg ${formatNumber((argWords - 1) * 4)}(SP) ; arg${argWords - 1}\n`;
      }
      else if (argWords === 5) {
        asm += `SW reg ${formatNumber(16)}(SP) ; arg4\n`;
      }
      asm += "\n";
    }

    if (localDataWords) {
      asm += "; Access local data:\n";

      let localStackOffset = argumentSectionSize + savedRegSectionSize + lowerPadSize + savedTempRegSectionSize;

      asm += `LW reg ${formatNumber(localStackOffset)}(SP) ; local0\n`;

      if (localDataWords > 2) {
        asm += "...\n";
        const lastLocalOffset = localStackOffset + ((localDataWords - 1) * 4);
        asm += `LW reg ${formatNumber(lastLocalOffset)}(SP) ; local${localDataWords - 1}\n`;
      }
      else if (localDataWords === 2) {
        asm += `LW reg ${formatNumber(localStackOffset + 4)}(SP) ; local1\n`;
      }
      asm += "\n";
    }

    if (savedTempRegSectionSize) {
      asm += generateSavedRegisterCode(this.usedRegisters, "LW", callerSavedTopOffset, callerSaved, formatNumber);
      asm += "\n";
    }

    if (asm.endsWith(beginCodeMessage)) {
      asm = asm.slice(0, -(beginCodeMessage.length));
      asm += "; Your code\n\n";
    }
    else {
      asm += "; End code\n\n";
    }
  }

  if (savedRegSectionSize) {
    asm += generateSavedRegisterCode(this.usedRegisters, "LW", calleeSavedTopOffset, calleeSaved, formatNumber);
  }

  asm += "JR RA\n";

  if (stackSize > 0)
    asm += `ADDIU SP SP ${formatNumber(stackSize)}`;
  else
    asm += "NOP";

  return asm.trim();
}

function generateSavedRegisterCode(usedRegisters, op, maxOffset, regFilter, formatNumber) {
  let asm = "";
  let currentOffset = maxOffset;
  for (let i = regs.length - 1; i >= 0; i--) {
    const reg = regs[i];
    if (usedRegisters[reg] && (!regFilter || regFilter.indexOf(reg) >= 0)) {
      asm += `${op} ${reg.toUpperCase()} ${formatNumber(currentOffset)}(SP)\n`;
      currentOffset -= 4;
    }
  }
  return asm;
}
