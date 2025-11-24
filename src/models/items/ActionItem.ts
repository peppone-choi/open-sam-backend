/**
 * ActionItem – thin base class for concrete items.
 *
 * This keeps the hierarchy explicit (BaseItem → ActionItem → concrete item)
 * while allowing future shared behaviour for action‑type items.
 */

import { BaseItem } from '../item.model';

export abstract class ActionItem extends BaseItem {}
