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
  argCount: 0,
  localDataWords: 0,
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
  const argCount = Math.max(0, this.argCount);
  const argumentSectionSize = argCount * 4;
  const savedRegSectionSize = this.savedRegisterCount * 4;
  const savedTempRegSectionSize = this.savedTempRegisterCount * 4;
  const localDataWords = Math.max(0, this.localDataWords);
  const localDataSectionSize = localDataWords * 4;

  const hasSomeLowerSections = !!argumentSectionSize || !!savedRegSectionSize;
  const lowerSectionsDivBy8 = !!((argumentSectionSize + savedRegSectionSize) % 8);
  const lowerPadSize = (hasSomeLowerSections && lowerSectionsDivBy8) ? 4 : 0;

  const stackSize = argumentSectionSize + savedRegSectionSize + lowerPadSize + savedTempRegSectionSize + localDataSectionSize;

  const upperPadSize = (stackSize % 8) ? 4 : 0;

  let asm = "";

  if (stackSize > 0) {
    const totalPad = lowerPadSize + upperPadSize;
    const padText = totalPad ? ` ; Including ${totalPad} byte pad` : "";
    asm += `ADDIU SP SP -${stackSize}${padText}\n`;
  }

  const calleeSavedTopOffset = argumentSectionSize + savedRegSectionSize - 4;
  if (savedRegSectionSize) {
    asm += generateSavedRegisterCode(this.usedRegisters, "SW", calleeSavedTopOffset, calleeSaved);
    asm += "\n";
  }

  const beginCodeMessage = "; Begin code\n\n";
  asm += beginCodeMessage;

  const callerSavedTopOffset = argumentSectionSize + savedRegSectionSize + lowerPadSize + savedTempRegSectionSize - 4;
  if (savedTempRegSectionSize) {
    asm += generateSavedRegisterCode(this.usedRegisters, "SW", callerSavedTopOffset, callerSaved);
    asm += "\n";
  }

  if (argCount > 4) {
    asm += "; Access additional arguments:\n";
    asm += `LW reg 16(SP) ; arg4\n`;

    if (argCount > 6) {
      asm += "...\n";
      asm += `LW reg ${(argCount - 1) * 4}(SP) ; arg${argCount - 1}\n`;
    }
    else if (argCount === 6) {
      asm += `LW reg 20(SP) ; arg5\n`;
    }
    asm += "\n";
  }

  if (localDataWords) {
    asm += "; Access local data:\n";

    let localStackOffset = argumentSectionSize + savedRegSectionSize + lowerPadSize + savedTempRegSectionSize;

    asm += `LW reg ${localStackOffset}(SP) ; local0\n`;

    if (localDataWords > 2) {
      asm += "...\n";
      const lastLocalOffset = localStackOffset + ((localDataWords - 1) * 4);
      asm += `LW reg ${lastLocalOffset}(SP) ; local${localDataWords - 1}\n`;
    }
    else if (localDataWords === 2) {
      asm += `LW reg ${localStackOffset + 4}(SP) ; local1\n`;
    }
    asm += "\n";
  }

  if (savedTempRegSectionSize) {
    asm += generateSavedRegisterCode(this.usedRegisters, "LW", callerSavedTopOffset, callerSaved);
    asm += "\n";
  }

  if (asm.endsWith(beginCodeMessage)) {
    asm = asm.slice(0, -(beginCodeMessage.length));
    asm += "; Your code\n\n";
  }
  else {
    asm += "; End code\n\n";
  }

  if (savedRegSectionSize) {
    asm += generateSavedRegisterCode(this.usedRegisters, "LW", calleeSavedTopOffset, calleeSaved);
  }

  asm += "JR RA\n";

  if (stackSize > 0)
    asm += `ADDIU SP SP ${stackSize}`;
  else
    asm += "NOP";

  return asm.trim();
}

function generateSavedRegisterCode(usedRegisters, op, maxOffset, regFilter) {
  let asm = "";
  let currentOffset = maxOffset;
  for (let i = regs.length - 1; i >= 0; i--) {
    const reg = regs[i];
    if (usedRegisters[reg] && (!regFilter || regFilter.indexOf(reg) >= 0)) {
      asm += `${op} ${reg.toUpperCase()} ${currentOffset}(SP)\n`;
      currentOffset -= 4;
    }
  }
  return asm;
}
