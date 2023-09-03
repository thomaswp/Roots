export class Event<Args> {
    
    private handlers: ((args: Args) => void)[] = [];

    addHandler(handler: (args: Args) => void) {
        this.handlers.push(handler);
    }

    removeHandler(handler: (args: Args) => void) {
        this.handlers = this.handlers.filter(h => h !== handler);
    }

    emit(args: Args) {
        this.handlers.slice(0).forEach(h => h(args));
    }

    clearHandlers() {
        this.handlers = [];
    }
}