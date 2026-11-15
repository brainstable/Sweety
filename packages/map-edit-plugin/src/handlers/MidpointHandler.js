import { VertexHandler } from './VertexHandler.js';

/**
 * Вставка вершины кликом по середине сегмента. Отличается от VertexHandler
 * только тем, что плагин перед началом drag создаёт новую вершину и продолжает
 * перетаскивать уже её.
 */
export class MidpointHandler extends VertexHandler {}
