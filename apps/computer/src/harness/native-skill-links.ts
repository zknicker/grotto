import { mkdir, readlink, symlink } from 'node:fs/promises';
import { join } from 'node:path';

/** Links the shared skill set into each runtime-native home. */
export async function ensureNativeSkillLinks(homeDir: string, skillsDir: string): Promise<void> {
    for (const nativeDir of ['.agents', '.claude']) {
        const parent = join(homeDir, nativeDir);
        const target = join(parent, 'skills');
        await mkdir(parent, { mode: 0o700, recursive: true });
        try {
            await symlink(skillsDir, target, 'dir');
        } catch (cause) {
            const linksSharedSkills =
                cause !== null &&
                typeof cause === 'object' &&
                'code' in cause &&
                cause.code === 'EEXIST' &&
                (await readlink(target)) === skillsDir;
            if (!linksSharedSkills) {
                throw cause;
            }
        }
    }
}
