export type JarModes = {
  file: number;
  dir: number;
};

export type JarStore = {
  read: (path: string) => Promise<string | null>;
  writeAtomic: (path: string, contents: string) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
  remove: (path: string) => Promise<void>;
  list: (dir: string) => Promise<string[]>;
  modes: () => JarModes;
};

const JAR_FILE_MODE = 0o600;
const JAR_DIR_MODE = 0o700;

export const createFsJarStore = (): JarStore => {
  const read = async (path: string): Promise<string | null> => {
    const { readFileSync, existsSync } = await import("node:fs");
    let contents: string | null = null;
    if (existsSync(path)) {
      contents = readFileSync(path, "utf8");
    }
    return contents;
  };

  const writeAtomic = async (path: string, contents: string): Promise<void> => {
    const { mkdirSync, writeFileSync, renameSync, chmodSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    mkdirSync(dirname(path), { recursive: true, mode: JAR_DIR_MODE });
    const temp = `${path}.tmp-${process.pid}`;
    writeFileSync(temp, contents, { mode: JAR_FILE_MODE });
    chmodSync(temp, JAR_FILE_MODE);
    renameSync(temp, path);
  };

  const exists = async (path: string): Promise<boolean> => {
    const { existsSync } = await import("node:fs");
    return existsSync(path);
  };

  const remove = async (path: string): Promise<void> => {
    const { rmSync } = await import("node:fs");
    rmSync(path, { force: true });
  };

  const list = async (dir: string): Promise<string[]> => {
    const { readdirSync, existsSync } = await import("node:fs");
    let names: string[] = [];
    if (existsSync(dir)) {
      names = readdirSync(dir).filter((name) => name.endsWith(".json"));
    }
    return names;
  };

  const modes = (): JarModes => ({ file: JAR_FILE_MODE, dir: JAR_DIR_MODE });

  return { read, writeAtomic, exists, remove, list, modes };
};
