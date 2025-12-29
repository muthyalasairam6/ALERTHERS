import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContactService } from '../../services/contact.service';
import { Group } from '../../models/group.model';
import { Contact } from '../../models/contact.model';

@Component({
  selector: 'app-contacts',
  templateUrl: './contacts.component.html',
  imports: [CommonModule],
})
export class ContactsComponent {
  contactService = inject(ContactService);
  contacts = this.contactService.contacts;
  groups = this.contactService.groups;
  
  view = signal<'contacts' | 'groups'>('contacts');

  // New Contact State
  newContactName = signal('');
  newContactPhone = signal('');
  
  // Group Modal State
  isGroupModalOpen = signal(false);
  editingGroup = signal<Group | null>(null);
  groupName = signal('');
  selectedContactIdsInModal = signal<Set<number>>(new Set());

  getContactsForGroup(group: Group): Contact[] {
    return this.contactService.getContactsForGroup(group);
  }

  // --- Contact Methods ---
  addContact() {
    this.contactService.addContact(this.newContactName(), this.newContactPhone());
    this.newContactName.set('');
    this.newContactPhone.set('');
  }

  deleteContact(id: number) {
    this.contactService.deleteContact(id);
  }

  onNameInput(event: Event) {
    this.newContactName.set((event.target as HTMLInputElement).value);
  }

  onPhoneInput(event: Event) {
    this.newContactPhone.set((event.target as HTMLInputElement).value);
  }

  onGroupNameInput(event: Event) {
    this.groupName.set((event.target as HTMLInputElement).value);
  }

  // --- Group Methods ---
  openNewGroupModal() {
    this.editingGroup.set(null);
    this.groupName.set('');
    this.selectedContactIdsInModal.set(new Set());
    this.isGroupModalOpen.set(true);
  }

  openEditGroupModal(group: Group) {
    this.editingGroup.set(group);
    this.groupName.set(group.name);
    this.selectedContactIdsInModal.set(new Set(group.contactIds));
    this.isGroupModalOpen.set(true);
  }

  closeGroupModal() {
    this.isGroupModalOpen.set(false);
  }
  
  toggleContactInGroup(contactId: number) {
    this.selectedContactIdsInModal.update(ids => {
      const newIds = new Set(ids);
      if (newIds.has(contactId)) {
        newIds.delete(contactId);
      } else {
        newIds.add(contactId);
      }
      return newIds;
    });
  }
  
  saveGroup() {
    const name = this.groupName().trim();
    if (!name) return;

    const contactIds = Array.from(this.selectedContactIdsInModal());
    const currentGroup = this.editingGroup();

    if (currentGroup) {
      this.contactService.updateGroup({ ...currentGroup, name, contactIds });
    } else {
      this.contactService.addGroup(name, contactIds);
    }
    this.closeGroupModal();
  }

  deleteGroup(id: number) {
    this.contactService.deleteGroup(id);
  }
}
