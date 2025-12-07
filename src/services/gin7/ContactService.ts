import { v4 as uuidv4 } from 'uuid';
import { Gin7Contact, IGin7Contact } from '../../models/gin7/Contact';
import { Gin7Character } from '../../models/gin7/Character';

export interface AddContactParams {
  sessionId: string;
  ownerId: string;
  contactId: string;
  nickname?: string;
  notes?: string;
}

class ContactService {
  /**
   * Add a contact (exchange business cards)
   */
  async addContact(params: AddContactParams): Promise<IGin7Contact> {
    const { sessionId, ownerId, contactId, nickname, notes } = params;

    // Check if contact already exists
    const existing = await Gin7Contact.findOne({
      sessionId,
      ownerId,
      contactId
    });

    if (existing) {
      throw new Error('Contact already exists');
    }

    // Get contact's character info
    const contactChar = await Gin7Character.findOne({ sessionId, characterId: contactId });
    if (!contactChar) {
      throw new Error('Contact character not found');
    }

    const contact = await Gin7Contact.create({
      contactEntryId: uuidv4(),
      sessionId,
      ownerId,
      contactId,
      contactName: contactChar.name,
      nickname,
      notes,
      isFavorite: false,
      isBlocked: false,
      addedAt: new Date()
    });

    return contact;
  }

  /**
   * Request mutual contact exchange
   * Creates contact entry for both parties
   */
  async exchangeContacts(
    sessionId: string,
    requesterId: string,
    targetId: string
  ): Promise<{ requesterContact: IGin7Contact; targetContact: IGin7Contact }> {
    // Get both characters
    const [requester, target] = await Promise.all([
      Gin7Character.findOne({ sessionId, characterId: requesterId }),
      Gin7Character.findOne({ sessionId, characterId: targetId })
    ]);

    if (!requester || !target) {
      throw new Error('One or both characters not found');
    }

    // Create contact entries for both
    const [requesterContact, targetContact] = await Promise.all([
      this.addContact({ sessionId, ownerId: requesterId, contactId: targetId }).catch(() => 
        Gin7Contact.findOne({ sessionId, ownerId: requesterId, contactId: targetId })
      ),
      this.addContact({ sessionId, ownerId: targetId, contactId: requesterId }).catch(() =>
        Gin7Contact.findOne({ sessionId, ownerId: targetId, contactId: requesterId })
      )
    ]);

    return { 
      requesterContact: requesterContact as IGin7Contact, 
      targetContact: targetContact as IGin7Contact 
    };
  }

  /**
   * Get all contacts for an owner
   */
  async getContacts(
    sessionId: string,
    ownerId: string,
    includeBlocked = false
  ): Promise<IGin7Contact[]> {
    const query: Record<string, any> = { sessionId, ownerId };
    if (!includeBlocked) {
      query.isBlocked = false;
    }

    return Gin7Contact.find(query).sort({ isFavorite: -1, contactName: 1 });
  }

  /**
   * Update contact (nickname, notes, favorite, blocked)
   */
  async updateContact(
    sessionId: string,
    ownerId: string,
    contactId: string,
    updates: {
      nickname?: string;
      notes?: string;
      isFavorite?: boolean;
      isBlocked?: boolean;
    }
  ): Promise<IGin7Contact | null> {
    return Gin7Contact.findOneAndUpdate(
      { sessionId, ownerId, contactId },
      { $set: updates },
      { new: true }
    );
  }

  /**
   * Remove a contact
   */
  async removeContact(sessionId: string, ownerId: string, contactId: string): Promise<boolean> {
    const result = await Gin7Contact.deleteOne({ sessionId, ownerId, contactId });
    return result.deletedCount > 0;
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(sessionId: string, ownerId: string, contactId: string): Promise<boolean> {
    const contact = await Gin7Contact.findOne({ sessionId, ownerId, contactId });
    if (!contact) return false;

    contact.isFavorite = !contact.isFavorite;
    await contact.save();
    return contact.isFavorite;
  }

  /**
   * Toggle blocked status
   */
  async toggleBlocked(sessionId: string, ownerId: string, contactId: string): Promise<boolean> {
    const contact = await Gin7Contact.findOne({ sessionId, ownerId, contactId });
    if (!contact) return false;

    contact.isBlocked = !contact.isBlocked;
    await contact.save();
    return contact.isBlocked;
  }

  /**
   * Search contacts by name or nickname
   */
  async searchContacts(
    sessionId: string,
    ownerId: string,
    query: string
  ): Promise<IGin7Contact[]> {
    const regex = new RegExp(query, 'i');
    return Gin7Contact.find({
      sessionId,
      ownerId,
      isBlocked: false,
      $or: [
        { contactName: regex },
        { nickname: regex }
      ]
    });
  }

  /**
   * Check if character is in contacts
   */
  async isContact(sessionId: string, ownerId: string, contactId: string): Promise<boolean> {
    const count = await Gin7Contact.countDocuments({ sessionId, ownerId, contactId });
    return count > 0;
  }

  /**
   * Get favorite contacts
   */
  async getFavorites(sessionId: string, ownerId: string): Promise<IGin7Contact[]> {
    return Gin7Contact.find({
      sessionId,
      ownerId,
      isFavorite: true,
      isBlocked: false
    }).sort({ contactName: 1 });
  }
}

export default new ContactService();

