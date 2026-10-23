/**
 * Public API of the events module — the only path other modules and the
 * app root may import from. Repositories, mappers and internal services
 * stay private to this folder (enforced by eslint no-restricted-imports).
 */
export { EventsModule } from "./events.module";
export { EventsService } from "./events.service";
export { eventsRouter } from "./events.router";
