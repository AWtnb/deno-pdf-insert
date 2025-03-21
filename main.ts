import { existsSync } from "jsr:@std/fs";
import { sprintf } from "jsr:@std/fmt/printf";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { PDFDocument } from "https://cdn.skypack.dev/pdf-lib?dts";

const withSuffix = (path: string, suffix: string): string => {
    const parts = path.split(".");
    const extension = parts.pop() || "pdf";
    return parts.join(".") + suffix + "." + extension;
};

const insertPages = async (
    path: string,
    insert: string,
    fromIdx: number,
): Promise<number> => {
    const baseData = await Deno.readFile(path);
    const baseDoc = await PDFDocument.load(baseData);
    const baseCount = baseDoc.getPageCount();
    const insertData = await Deno.readFile(insert);
    const insertDoc = await PDFDocument.load(insertData);
    const insertCount = insertDoc.getPageCount();

    if (fromIdx < 0) {
        fromIdx = baseCount + fromIdx;
    }
    const outDoc = await PDFDocument.create();

    const prePages = await outDoc.copyPages(
        baseDoc,
        baseDoc.getPageIndices().filter(
            (idx: number) => idx < fromIdx,
        ).map((idx: number) => idx),
    );
    prePages.forEach((page) => outDoc.addPage(page));

    (await outDoc.copyPages(
        insertDoc,
        insertDoc.getPageIndices(),
    )).forEach((page) => outDoc.addPage(page));

    const postPages = await outDoc.copyPages(
        baseDoc,
        baseDoc.getPageIndices().filter(
            (idx: number) => fromIdx <= idx,
        ).map((idx: number) => idx),
    );
    postPages.forEach((page) => outDoc.addPage(page));

    const bytes = await outDoc.save();
    const suf = sprintf(
        "_insert%03d-%03d",
        fromIdx + 1,
        Math.min(baseCount, fromIdx + insertCount),
    );
    const outPath = withSuffix(path, suf);
    await Deno.writeFile(outPath, bytes);
    return 0;
};

const parsePage = (nombre: string): number => {
    const n = Number(nombre);
    if (0 < n) {
        return n - 1;
    }
    return n;
};

const main = async () => {
    const flags = parseArgs(Deno.args, {
        string: ["path", "insert", "frompage"],
        default: {
            path: "",
            insert: "",
            frompage: "1",
        },
    });
    if (isNaN(Number(flags.frompage))) {
        console.log("invalid arg:", flags.frompage);
        Deno.exit(1);
    }
    if (!existsSync(flags.path)) {
        console.log("target path not found!");
        Deno.exit(1);
    }
    if (!existsSync(flags.insert)) {
        console.log("insert path not found!");
        Deno.exit(1);
    }
    const fromIdx: number = parsePage(flags.frompage);
    const result = await insertPages(flags.path, flags.insert, fromIdx);
    Deno.exit(result);
};

main();
