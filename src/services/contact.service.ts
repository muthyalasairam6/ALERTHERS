import { Injectable, signal } from '@angular/core';
import { Contact } from '../models/contact.model';
import { Group } from '../models/group.model';

@Injectable({
  providedIn: 'root',
})
export class ContactService {
  private readonly CONTACT_STORAGE_KEY = 'safety_app_contacts';
  private readonly GROUP_STORAGE_KEY = 'safety_app_groups';
  
  contacts = signal<Contact[]>([]);
  groups = signal<Group[]>([]);

  constructor() {
    this.loadContacts();
    this.loadGroups();
  }

  // --- Contact Methods ---

  private loadContacts(): void {
    try {
      const storedContacts = localStorage.getItem(this.CONTACT_STORAGE_KEY);
      if (storedContacts) {
        this.contacts.set(JSON.parse(storedContacts));
      }
    } catch (e) {
      console.error('Error reading contacts from localStorage', e);
    }
  }

  private saveContacts(): void {
    try {
      localStorage.setItem(this.CONTACT_STORAGE_KEY, JSON.stringify(this.contacts()));
    } catch (e) {
      console.error('Error saving contacts to localStorage', e);
    }
  }

  addContact(name: string, phone: string): void {
    if (!name || !phone) return;
    this.contacts.update(contacts => [
      ...contacts,
      { id: Date.now(), name, phone },
    ]);
    this.saveContacts();
  }

  deleteContact(id: number): void {
    this.contacts.update(contacts => contacts.filter(c => c.id !== id));
    this.saveContacts();
    // Also remove contact from any groups
    this.groups.update(groups => 
      groups.map(group => ({
        ...group,
        contactIds: group.contactIds.filter(contactId => contactId !== id)
      }))
    );
    this.saveGroups();
  }

  // --- Group Methods ---

  private loadGroups(): void {
    try {
      const storedGroups = localStorage.getItem(this.GROUP_STORAGE_KEY);
      if (storedGroups) {
        this.groups.set(JSON.parse(storedGroups));
      }
    } catch (e) {
      console.error('Error reading groups from localStorage', e);
    }
  }

  private saveGroups(): void {
    try {
      localStorage.setItem(this.GROUP_STORAGE_KEY, JSON.stringify(this.groups()));
    } catch (e) {
      console.error('Error saving groups to localStorage', e);
    }
  }
  
  addGroup(name: string, contactIds: number[]): void {
    if (!name) return;
    this.groups.update(groups => [
      ...groups,
      { id: Date.now(), name, contactIds },
    ]);
    this.saveGroups();
  }
  
  updateGroup(updatedGroup: Group): void {
    this.groups.update(groups => 
      groups.map(g => g.id === updatedGroup.id ? updatedGroup : g)
    );
    this.saveGroups();
  }

  deleteGroup(id: number): void {
    this.groups.update(groups => groups.filter(g => g.id !== id));
    this.saveGroups();
  }

  getContactsForGroup(group: Group): Contact[] {
    const contactMap = new Map(this.contacts().map(c => [c.id, c]));
    return group.contactIds.map(id => contactMap.get(id)).filter((c): c is Contact => !!c);
  }
}
