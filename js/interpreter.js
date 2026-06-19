// Code Sandbox and Validation Interpreters
// Evaluates Luau (Roblox), Python, and JavaScript client-side

const CodexInterpreter = {
  
  // 1. Luau Runner (Roblox)
  runLuau: function(code, simulator) {
    // Reset simulator
    simulator.reset();
    
    let logs = [];
    let partsCreated = [];
    
    // Define Roblox simulation globals
    const Workspace = "Workspace";
    const game = {
      Workspace: "Workspace",
      Players: {
        LocalPlayer: { Name: "Builderman" },
        GetPlayers: () => [{ Name: "Builderman" }]
      },
      GetService: function(serviceName) {
        if (serviceName === "Players") return this.Players;
        if (serviceName === "Workspace") return Workspace;
        return {};
      }
    };
    
    const task = {
      wait: function(seconds) {
        // Mock wait (instantly logs wait time in sandbox)
        logs.push({ text: `[task.wait] Waited ${seconds} seconds`, type: 'info' });
      }
    };

    const table = {
      insert: function(t, val) {
        if (Array.isArray(t)) {
          t.push(val);
        }
      },
      remove: function(t, index) {
        if (Array.isArray(t)) {
          t.splice(index - 1, 1);
        }
      }
    };

    // RGB to Hex helper
    const rgbToHex = (r, g, b) => {
      const clamp = (val) => Math.min(255, Math.max(0, Math.floor(val)));
      const toHex = (c) => {
        const hex = clamp(c).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      };
      return "#" + toHex(r) + toHex(g) + toHex(b);
    };

    class PartMock {
      constructor() {
        this.Parent = null;
        this.Position = { x: 0, y: 0, z: 0 };
        this.Size = { x: 4, y: 4, z: 4 };
        this.Color = "#ffffff";
        this.BrickColor = "Medium stone grey";
        this.Transparency = 0;
        this.Anchored = false;
        this._simIndex = null;
        
        // Mock Touch Event
        this.Touched = {
          Connect: (callback) => {
            this._touchedCallback = callback;
            logs.push({ text: "Connected Touch event listener to Part.", type: 'info' });
          }
        };
      }
      
      updateSim(prop, val) {
        this[prop] = val;
        
        // Convert Roblox property names to lowercase simulator parameters
        if (this.Parent === Workspace || this.Parent === "Workspace") {
          if (this._simIndex === null) {
            // First time parenting to workspace, add to simulator
            const simPart = simulator.addPart({
              position: this.Position,
              size: this.Size,
              color: this.Color,
              brickColor: this.BrickColor,
              transparency: this.Transparency,
              anchored: this.Anchored
            });
            this._simIndex = simulator.parts.indexOf(simPart);
          } else {
            // Part already in simulator, update properties
            let simProp = prop.toLowerCase();
            // Handle Color mapping
            if (simProp === 'color' || simProp === 'brickcolor') {
              simulator.updatePartProperty(this._simIndex, 'color', val);
            } else {
              simulator.updatePartProperty(this._simIndex, simProp, val);
            }
          }
        }
      }
    }

    // Proxy wrapper to intercept Luau property setting, e.g. part.Size = Vector3.new(2,2,2)
    function createPartMock() {
      const mock = new PartMock();
      const proxy = new Proxy(mock, {
        set(target, prop, value) {
          target.updateSim(prop, value);
          return true;
        },
        get(target, prop) {
          return target[prop];
        }
      });
      partsCreated.push(proxy);
      return proxy;
    }

    const Instance = {
      new: function(className) {
        if (className === "Part") {
          return createPartMock();
        }
        return null;
      }
    };

    const Vector3 = {
      new: function(x, y, z) {
        return { x: Number(x) || 0, y: Number(y) || 0, z: Number(z) || 0 };
      }
    };

    const Color3 = {
      fromRGB: function(r, g, b) {
        return rgbToHex(r, g, b);
      }
    };

    // Print handler
    const print = function(...args) {
      const line = args.map(arg => {
        if (typeof arg === 'object') return JSON.stringify(arg);
        return String(arg);
      }).join(" ");
      logs.push({ text: line, type: 'info' });
    };

    // Translate basic Luau syntax to JavaScript
    let jsCode = code;
    
    // Replace comments: -- comment to // comment
    jsCode = jsCode.replace(/--.*/g, (match) => match.replace('--', '//'));
    
    // Replace colons: object:method(args) to object.method(args)
    jsCode = jsCode.replace(/(\w+):(\w+)\(/g, '$1.$2(');

    // Replace if statements: if condition then -> if (condition) {
    jsCode = jsCode.replace(/\bif\s+(.*?)\s+then\b/g, 'if ($1) {');
    jsCode = jsCode.replace(/\belseif\s+(.*?)\s+then\b/g, '} else if ($1) {');
    jsCode = jsCode.replace(/\belse\b/g, '} else {');
    
    // Replace while loops: while condition do -> while (condition) {
    jsCode = jsCode.replace(/\bwhile\s+(.*?)\s+do\b/g, 'while ($1) {');

    // Replace for loops: for i = 1, 10 do -> for (let i = 1; i <= 10; i++) {
    // and for i = 1, 10, 2 do -> for (let i = 1; i <= 10; i += 2) {
    jsCode = jsCode.replace(/\bfor\s+(\w+)\s*=\s*([^,]+)\s*,\s*([^,]+)\s*do\b/g, 'for (let $1 = $2; $1 <= $3; $1++) {');
    jsCode = jsCode.replace(/\bfor\s+(\w+)\s*=\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*do\b/g, 'for (let $1 = $2; $1 <= $3; $1 += $4) {');

    // Translate named functions: function name(a, b) -> function name(a, b) {
    jsCode = jsCode.replace(/\bfunction\s+(\w+)\s*\((.*?)\)/g, 'function $1($2) {');
    
    // Translate anonymous functions: function(a, b) -> function(a, b) {
    jsCode = jsCode.replace(/\bfunction\s*\((.*?)\)/g, 'function($1) {');

    // Replace string concatenation .. with +
    jsCode = jsCode.replace(/\.\./g, ' + ');

    // Replace inequality ~= with !=
    jsCode = jsCode.replace(/~=/g, ' != ');

    // Replace nil with null
    jsCode = jsCode.replace(/\bnil\b/g, 'null');

    // Replace local keyword with let
    jsCode = jsCode.replace(/\blocal\s+/g, 'let ');
    
    // Replace end with }
    jsCode = jsCode.replace(/\bend\b/g, '}');
    
    // Compile and run the sandboxed script
    try {
      const runner = new Function('Instance', 'Vector3', 'Color3', 'Workspace', 'game', 'task', 'table', 'print', jsCode);
      runner(Instance, Vector3, Color3, Workspace, game, task, table, print);

      // Start simulator physics loop if any unanchored parts exist
      const hasUnanchored = simulator.parts.some(p => !p.anchored);
      if (hasUnanchored) {
        simulator.startPhysics();
      }

      // Check for active touch callbacks to simulate collision test in checkpoint
      partsCreated.forEach(mock => {
        if (mock._touchedCallback) {
          // Trigger the callback with a mock hitter part
          try {
            mock._touchedCallback({ Name: "Baseplate" });
          } catch(e) {
            console.error("Touched event callback crash", e);
          }
        }
      });

      return {
        success: true,
        logs: logs,
        simState: { parts: simulator.parts, partsMocks: partsCreated }
      };
    } catch (err) {
      return {
        success: false,
        error: `Luau Runtime Error: ${err.message}`,
        logs: logs
      };
    }
  },

  // 2. Python Runner (Indentation-aware Compiler)
  runPython: function(code) {
    let logs = [];

    // Helper python builtins
    const len = (x) => {
      if (x && x.length !== undefined) return x.length;
      if (x && typeof x === 'object') return Object.keys(x).length;
      return 0;
    };

    const print = function(...args) {
      const line = args.map(arg => {
        if (typeof arg === 'boolean') return arg ? "True" : "False";
        if (arg === null) return "None";
        if (typeof arg === 'object') return JSON.stringify(arg);
        return String(arg);
      }).join(" ");
      logs.push({ text: line, type: 'info' });
    };

    // 1. Python to JS Transpiler
    let jsCode = "";
    let indentStack = [0];
    const lines = code.split('\n');

    try {
      for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const trimmed = rawLine.trim();

        if (!trimmed) {
          jsCode += "\n";
          continue;
        }

        // Calculate leading indentation
        const indent = rawLine.length - rawLine.trimStart().length;

        // Close blocks if indent decreased
        while (indent < indentStack[indentStack.length - 1]) {
          jsCode += "}\n";
          indentStack.pop();
        }

        let processedLine = trimmed;

        // Python Comments
        if (processedLine.startsWith('#')) {
          jsCode += "//" + processedLine.substring(1) + "\n";
          continue;
        }

        // Check if it starts a block (ends with colon)
        let isBlock = false;
        if (processedLine.endsWith(':')) {
          isBlock = true;
          processedLine = processedLine.substring(0, processedLine.length - 1).trim();
        }

        // Keyword Translation
        if (processedLine.startsWith('if ')) {
          processedLine = `if (${processedLine.substring(3)})`;
        } else if (processedLine.startsWith('elif ')) {
          processedLine = `else if (${processedLine.substring(5)})`;
        } else if (processedLine === 'else') {
          processedLine = 'else';
        } else if (processedLine.startsWith('def ')) {
          processedLine = `function ${processedLine.substring(4)}`;
        } else if (processedLine.startsWith('while ')) {
          processedLine = `while (${processedLine.substring(6)})`;
        } else if (processedLine.startsWith('for ') && processedLine.includes(' in ')) {
          const forMatch = processedLine.match(/for\s+(\w+)\s+in\s+(.*)/);
          if (forMatch) {
            const varName = forMatch[1];
            const iterVal = forMatch[2].trim();
            
            if (iterVal.startsWith('range(')) {
              const rangeArgs = iterVal.substring(6, iterVal.length - 1).split(',').map(s => s.trim());
              if (rangeArgs.length === 1) {
                processedLine = `for (let ${varName} = 0; ${varName} < ${rangeArgs[0]}; ${varName}++)`;
              } else if (rangeArgs.length === 2) {
                processedLine = `for (let ${varName} = ${rangeArgs[0]}; ${varName} < ${rangeArgs[1]}; ${varName}++)`;
              } else if (rangeArgs.length === 3) {
                processedLine = `for (let ${varName} = ${rangeArgs[0]}; ${varName} < ${rangeArgs[1]}; ${varName} += ${rangeArgs[2]})`;
              }
            } else {
              // for x in my_list -> for (let x of my_list)
              processedLine = `for (let ${varName} of ${iterVal})`;
            }
          }
        }

        // Method calls
        processedLine = processedLine.replace(/\.append\(/g, '.push(');

        // Booleans and None
        processedLine = processedLine.replace(/\bTrue\b/g, 'true');
        processedLine = processedLine.replace(/\bFalse\b/g, 'false');
        processedLine = processedLine.replace(/\bNone\b/g, 'null');

        // Variable assignment: x = 10 -> var x = 10
        // Prefix with 'var' to allow safe scoping redeclarations in JS
        if (processedLine.includes('=') && 
            !processedLine.startsWith('for') && 
            !processedLine.startsWith('if') && 
            !processedLine.startsWith('while') && 
            !processedLine.startsWith('return')) {
          const eqIdx = processedLine.indexOf('=');
          const lhs = processedLine.substring(0, eqIdx).trim();
          if (/^[a-zA-Z_]\w*$/.test(lhs)) {
            processedLine = `var ${processedLine}`;
          }
        }

        if (isBlock) {
          jsCode += processedLine + " {\n";
          indentStack.push(indent + 1);
        } else {
          jsCode += processedLine + ";\n";
        }
      }

      // Close open blocks
      while (indentStack.length > 1) {
        jsCode += "}\n";
        indentStack.pop();
      }

      // 2. ExecuteCompiled JS code
      const runner = new Function('print', 'len', jsCode);
      runner(print, len);
      return { success: true, logs: logs };

    } catch (err) {
      return { success: false, error: `Python Runtime Error: ${err.message}`, logs: logs };
    }
  },

  // 3. JavaScript Runner
  runJS: function(code) {
    let logs = [];
    const customConsole = {
      log: function(...args) {
        const line = args.map(arg => {
          if (typeof arg === 'object') return JSON.stringify(arg);
          return String(arg);
        }).join(" ");
        logs.push({ text: line, type: 'info' });
      }
    };

    try {
      const runner = new Function('console', code);
      runner(customConsole);
      return { success: true, logs: logs };
    } catch (err) {
      return { success: false, error: `JavaScript Error: ${err.message}`, logs: logs };
    }
  }
};

window.CodexInterpreter = CodexInterpreter;
