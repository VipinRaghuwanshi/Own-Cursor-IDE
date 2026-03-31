import 'dotenv/config';
import Groq from "groq-sdk";
import readlineSync from 'readline-sync';
import { exec } from "child_process";
import { promisify } from "util";
import fs from 'fs'; // ✅ Zaroori hai file likhne ke liye
import path from 'path';
import os from 'os';

const platform = os.platform();
const asyncExecute = promisify(exec);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const History = [];

// --- Tool Functions ---

async function executeCommand({ command }) {
    try {
        const { stdout, stderr } = await asyncExecute(command);
        if (stderr && !stderr.includes("already exists")) return `Error: ${stderr}`;
        return `Success: ${stdout || "Command executed successfully"}`;
    } catch (error) {
        if (error.message.includes("already exists")) return "Success: Directory already exists.";
        return `Error: ${error.message}`;
    }
}

// ✅ Ye naya function zaroori hai code save karne ke liye
async function writeFile({ filepath, content }) {
    try {
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filepath, content, 'utf8');
        return `Success: File written at ${filepath}`;
    } catch (error) {
        return `Error: ${error.message}`;
    }
}

// --- Tool Declarations ---

const tools = [
    {
        type: "function",
        function: {
            name: "executeCommand",
            description: "ONLY for creating folders with mkdir.",
            parameters: {
                type: "object",
                properties: { command: { type: "string" } },
                required: ["command"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "writeFile",
            description: "Use this to save HTML, CSS, and JS code.",
            parameters: {
                type: "object",
                properties: {
                    filepath: { type: "string", description: "Path including filename (e.g., 'calc/index.html')" },
                    content: { type: "string", description: "The full source code to write." }
                },
                required: ["filepath", "content"]
            }
        }
    }
];

const availableTools = { executeCommand, writeFile }; // ✅ Dono tools register ho gaye

const systemPrompt = `You are a Website Builder Expert. 
Current OS: ${platform}

Your mission is to build a complete, functional frontend website based on user requirements.

STRICT WORKFLOW (Do not skip):
1. **Folder Creation**: Use 'executeCommand' ONLY to create the project directory (e.g., mkdir "my-site").
2. **File Writing**: Use 'writeFile' for ALL source code. NEVER use 'echo', 'touch', or 'cat' via executeCommand.
3. **Completeness**: You must provide full, beautiful, and responsive code for:
   - index.html (with links to CSS/JS)
   - style.css (modern UI)
   - script.js (interactive logic)

CRITICAL RULE:
- If a directory already exists, proceed directly to writing the files. 
- You MUST call the 'writeFile' tool for each file separately with the full code content.
- Do NOT just explain what you are doing; execute the tools!`;

async function runAgent(userProblem) {
    History.push({ role: 'user', content: userProblem });

    while (true) {
        const response = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [{ role: "system", content: systemPrompt }, ...History],
            tools: tools,
            tool_choice: "auto",
        });

        const message = response.choices[0].message;

        if (message.tool_calls) {
            History.push(message);

            for (const toolCall of message.tool_calls) {
                const { name, arguments: argsString } = toolCall.function;
                const args = JSON.parse(argsString);

                console.log(`\n🔧 Tool Call: ${name}`);
                if (name === "writeFile") console.log(`📄 Writing to: ${args.filepath}`);

                const result = await availableTools[name](args);
                console.log(`✅ Result: ${result}`);

                History.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: result
                });
            }
        } else {
            console.log("\n🤖 Agent:", message.content);
            break;
        }
    }
}

async function main() {
    console.log("🚀 Cursor Clone Ready!");
    const userProblem = readlineSync.question("\nKya banana hai? --> ");
    if (userProblem.toLowerCase() === 'exit') process.exit();
    await runAgent(userProblem);
    main();
}

main();