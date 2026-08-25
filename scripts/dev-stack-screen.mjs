import {
    formatGrottoLine,
    formatHeader,
    formatLogLine,
    getSnapshotChangeLines,
    snapshotDigest,
    theme,
} from './dev-stack-log-format.mjs';

export class DevStackScreen {
    constructor(controller) {
        this.controller = controller;
        this.colorize = Boolean(process.stdout.isTTY);
        this.previousSnapshot = snapshotDigest(controller.getSnapshot());
        this.stopped = false;
        this.handleUpdate = (snapshot) => {
            this.printSnapshotChanges(snapshot);
        };
        this.handleLog = (entry) => {
            this.write(formatLogLine(entry, { colorize: this.colorize }));
        };
    }

    start() {
        this.stopped = false;
        const snapshot = this.controller.getSnapshot();

        this.write(formatHeader(snapshot, { colorize: this.colorize }));
        this.controller.on('update', this.handleUpdate);
        this.controller.on('log', this.handleLog);
    }

    stop() {
        if (this.stopped) {
            return;
        }
        this.stopped = true;
        this.controller.off('update', this.handleUpdate);
        this.controller.off('log', this.handleLog);

        const snapshot = this.controller.getSnapshot();
        this.printFinalSummary(snapshot);
    }

    printSnapshotChanges(snapshot) {
        const nextDigest = snapshotDigest(snapshot);
        const lines = getSnapshotChangeLines(this.previousSnapshot, nextDigest, snapshot, {
            colorize: this.colorize,
        });

        for (const line of lines) {
            this.write(line);
        }

        this.previousSnapshot = nextDigest;
    }

    printFinalSummary(snapshot) {
        const failedProcesses = Object.entries(snapshot.processes)
            .filter(([, processState]) => processState.status === 'error')
            .map(([name]) => name);

        if (failedProcesses.length > 0) {
            this.write(
                formatGrottoLine(`startup failed: ${failedProcesses.join(', ')}`, {
                    color: theme.danger,
                    colorize: this.colorize,
                    icon: '✕',
                })
            );
            return;
        }

        this.write(
            formatGrottoLine('stack stopped', {
                color: theme.muted,
                colorize: this.colorize,
                icon: '·',
            })
        );
    }

    write(value) {
        process.stdout.write(`${value}\n`);
    }
}
