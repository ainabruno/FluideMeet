import {
  users,
  profiles,
  events,
  messages,
  resources,
  eventRegistrations,
  userInteractions,
  profilePhotos,
  professionalProfiles,
  professionalServices,
  serviceBookings,
  type User,
  type UpsertUser,
  type Profile,
  type InsertProfile,
  type Event,
  type InsertEvent,
  type Message,
  type InsertMessage,
  type Resource,
  type InsertResource,
  type EventRegistration,
  type InsertEventRegistration,
  type UserInteraction,
  type InsertUserInteraction,
  type ProfilePhoto,
  type InsertProfilePhoto,
  type ProfessionalProfile,
  type InsertProfessionalProfile,
  type ProfessionalService,
  type InsertProfessionalService,
  type ServiceBooking,
  type InsertServiceBooking,
} from "@shared/schema";
import { getDb } from "./db";
import { eq, desc, asc, and, or, like, count, sql } from "drizzle-orm";

const db = getDb();

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Profile operations
  getProfile(userId: string): Promise<Profile | undefined>;
  getProfileByDisplayName(displayName: string): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateProfile(userId: string, profile: Partial<InsertProfile>): Promise<Profile>;
  searchProfiles(filters: {
    minAge?: number;
    maxAge?: number;
    location?: string;
    practices?: string[];
    values?: string[];
    intentions?: string[];
    limit?: number;
    offset?: number;
  }): Promise<Profile[]>;
  
  // Event operations
  getEvents(filters?: { category?: string; upcoming?: boolean; limit?: number; offset?: number }): Promise<Event[]>;
  getEvent(id: number): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, event: Partial<InsertEvent>): Promise<Event>;
  registerForEvent(registration: InsertEventRegistration): Promise<EventRegistration>;
  getEventRegistrations(eventId: number): Promise<EventRegistration[]>;
  getUserEventRegistrations(userId: string): Promise<EventRegistration[]>;
  
  // Message operations
  getMessages(userId1: string, userId2: string): Promise<Message[]>;
  sendMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(messageId: number): Promise<void>;
  getConversations(userId: string): Promise<{ user: User; lastMessage: Message; unreadCount: number }[]>;
  
  // Resource operations
  getResources(filters?: { type?: string; category?: string; limit?: number; offset?: number }): Promise<Resource[]>;
  getResource(id: number): Promise<Resource | undefined>;
  createResource(resource: InsertResource): Promise<Resource>;
  
  // User interaction operations
  createInteraction(interaction: InsertUserInteraction): Promise<UserInteraction>;
  getInteraction(userId: string, targetUserId: string, type: string): Promise<UserInteraction | undefined>;
  getUserLikes(userId: string): Promise<UserInteraction[]>;
  getUserMatches(userId: string): Promise<User[]>;
  
  // Photo operations
  addProfilePhoto(photo: InsertProfilePhoto): Promise<ProfilePhoto>;
  getProfilePhotos(profileId: number): Promise<ProfilePhoto[]>;
  updateProfilePhoto(id: number, updates: Partial<InsertProfilePhoto>): Promise<ProfilePhoto>;
  deleteProfilePhoto(id: number): Promise<void>;
  
  // Professional operations
  getProfessionals(filters?: { 
    search?: string; 
    specialty?: string; 
    location?: string; 
    limit?: number; 
    offset?: number; 
  }): Promise<ProfessionalProfile[]>;
  getProfessional(id: number): Promise<ProfessionalProfile | undefined>;
  getProfessionalByUserId(userId: string): Promise<ProfessionalProfile | undefined>;
  createProfessionalProfile(profile: InsertProfessionalProfile): Promise<ProfessionalProfile>;
  updateProfessionalProfile(id: number, profile: Partial<InsertProfessionalProfile>): Promise<ProfessionalProfile>;
  
  // Professional services
  getProfessionalServices(professionalId: number): Promise<ProfessionalService[]>;
  createProfessionalService(service: InsertProfessionalService): Promise<ProfessionalService>;
  updateProfessionalService(id: number, service: Partial<InsertProfessionalService>): Promise<ProfessionalService>;
  
  // Service bookings
  createServiceBooking(booking: InsertServiceBooking): Promise<ServiceBooking>;
  getProfessionalBookings(professionalId: number): Promise<ServiceBooking[]>;
  getClientBookings(clientId: string): Promise<ServiceBooking[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Profile operations
  async getProfile(userId: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
    return profile;
  }

  async getProfileByDisplayName(displayName: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.displayName, displayName));
    return profile;
  }

  async createProfile(profile: InsertProfile): Promise<Profile> {
    const [newProfile] = await db.insert(profiles).values(profile).returning();
    return newProfile;
  }

  async updateProfile(userId: string, profileData: Partial<InsertProfile>): Promise<Profile> {
    const [profile] = await db
      .update(profiles)
      .set({ ...profileData, updatedAt: new Date() })
      .where(eq(profiles.userId, userId))
      .returning();
    return profile;
  }

  async searchProfiles(filters: {
    minAge?: number;
    maxAge?: number;
    location?: string;
    practices?: string[];
    values?: string[];
    intentions?: string[];
    limit?: number;
    offset?: number;
  }): Promise<Profile[]> {
    const conditions = [eq(profiles.isVisible, true)];
    
    if (filters.minAge || filters.maxAge) {
      const currentDate = new Date();
      if (filters.maxAge) {
        const minBirthDate = new Date(currentDate.getFullYear() - filters.maxAge - 1, currentDate.getMonth(), currentDate.getDate());
        conditions.push(sql`${profiles.birthDate} >= ${minBirthDate}`);
      }
      if (filters.minAge) {
        const maxBirthDate = new Date(currentDate.getFullYear() - filters.minAge, currentDate.getMonth(), currentDate.getDate());
        conditions.push(sql`${profiles.birthDate} <= ${maxBirthDate}`);
      }
    }
    
    if (filters.location) {
      conditions.push(like(profiles.location, `%${filters.location}%`));
    }
    
    return await db.select()
      .from(profiles)
      .where(and(...conditions))
      .orderBy(desc(profiles.lastActive))
      .limit(filters.limit || 20)
      .offset(filters.offset || 0);
  }

  // Event operations
  async getEvents(filters?: { category?: string; upcoming?: boolean; limit?: number; offset?: number }): Promise<Event[]> {
    const conditions = [eq(events.isApproved, true)];
    
    if (filters?.category) {
      conditions.push(eq(events.category, filters.category));
    }
    
    if (filters?.upcoming) {
      conditions.push(sql`${events.startDate} > NOW()`);
    }
    
    return await db.select()
      .from(events)
      .where(and(...conditions))
      .orderBy(asc(events.startDate))
      .limit(filters?.limit || 20)
      .offset(filters?.offset || 0);
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db.insert(events).values(event).returning();
    return newEvent;
  }

  async updateEvent(id: number, eventData: Partial<InsertEvent>): Promise<Event> {
    const [event] = await db
      .update(events)
      .set({ ...eventData, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();
    return event;
  }

  async registerForEvent(registration: InsertEventRegistration): Promise<EventRegistration> {
    const [newRegistration] = await db.insert(eventRegistrations).values(registration).returning();
    return newRegistration;
  }

  async getEventRegistrations(eventId: number): Promise<EventRegistration[]> {
    return await db.select().from(eventRegistrations).where(eq(eventRegistrations.eventId, eventId));
  }

  async getUserEventRegistrations(userId: string): Promise<EventRegistration[]> {
    return await db.select().from(eventRegistrations).where(eq(eventRegistrations.userId, userId));
  }

  // Message operations
  async getMessages(userId1: string, userId2: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(
        or(
          and(eq(messages.senderId, userId1), eq(messages.receiverId, userId2)),
          and(eq(messages.senderId, userId2), eq(messages.receiverId, userId1))
        )
      )
      .orderBy(asc(messages.sentAt));
  }

  async sendMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }

  async markMessageAsRead(messageId: number): Promise<void> {
    await db.update(messages).set({ isRead: true }).where(eq(messages.id, messageId));
  }

  async getConversations(userId: string): Promise<{ user: User; lastMessage: Message; unreadCount: number }[]> {
    // This is a complex query that would need raw SQL or multiple queries
    // For now, return empty array - would need to implement proper conversation logic
    return [];
  }

  // Resource operations
  async getResources(filters?: { type?: string; category?: string; limit?: number; offset?: number }): Promise<Resource[]> {
    const conditions = [eq(resources.isPublished, true)];
    
    if (filters?.type) {
      conditions.push(eq(resources.type, filters.type));
    }
    
    if (filters?.category) {
      conditions.push(eq(resources.category, filters.category));
    }
    
    return await db.select()
      .from(resources)
      .where(and(...conditions))
      .orderBy(desc(resources.createdAt))
      .limit(filters?.limit || 20)
      .offset(filters?.offset || 0);
  }

  async getResource(id: number): Promise<Resource | undefined> {
    const [resource] = await db.select().from(resources).where(eq(resources.id, id));
    return resource;
  }

  async createResource(resource: InsertResource): Promise<Resource> {
    const [newResource] = await db.insert(resources).values(resource).returning();
    return newResource;
  }

  // User interaction operations
  async createInteraction(interaction: InsertUserInteraction): Promise<UserInteraction> {
    const [newInteraction] = await db.insert(userInteractions).values(interaction).returning();
    return newInteraction;
  }

  async getInteraction(userId: string, targetUserId: string, type: string): Promise<UserInteraction | undefined> {
    const [interaction] = await db
      .select()
      .from(userInteractions)
      .where(
        and(
          eq(userInteractions.userId, userId),
          eq(userInteractions.targetUserId, targetUserId),
          eq(userInteractions.type, type)
        )
      );
    return interaction;
  }

  async getUserLikes(userId: string): Promise<UserInteraction[]> {
    return await db
      .select()
      .from(userInteractions)
      .where(and(eq(userInteractions.userId, userId), eq(userInteractions.type, "like")));
  }

  async getUserMatches(userId: string): Promise<User[]> {
    // Complex query to find mutual likes - would need proper implementation
    return [];
  }

  // Photo operations
  async addProfilePhoto(photo: InsertProfilePhoto): Promise<ProfilePhoto> {
    const [newPhoto] = await db.insert(profilePhotos).values(photo).returning();
    return newPhoto;
  }

  async getProfilePhotos(profileId: number): Promise<ProfilePhoto[]> {
    return await db.select().from(profilePhotos).where(eq(profilePhotos.profileId, profileId));
  }

  async updateProfilePhoto(id: number, updates: Partial<InsertProfilePhoto>): Promise<ProfilePhoto> {
    const [photo] = await db
      .update(profilePhotos)
      .set(updates)
      .where(eq(profilePhotos.id, id))
      .returning();
    return photo;
  }

  async deleteProfilePhoto(id: number): Promise<void> {
    await db.delete(profilePhotos).where(eq(profilePhotos.id, id));
  }

  // Professional operations
  async getProfessionals(filters?: { 
    search?: string; 
    specialty?: string; 
    location?: string; 
    limit?: number; 
    offset?: number; 
  }): Promise<ProfessionalProfile[]> {
    const conditions = [eq(professionalProfiles.isActive, true)];
    
    if (filters?.search) {
      conditions.push(
        or(
          like(professionalProfiles.businessName, `%${filters.search}%`),
          like(professionalProfiles.description, `%${filters.search}%`)
        )
      );
    }
    
    if (filters?.specialty) {
      conditions.push(sql`${filters.specialty} = ANY(${professionalProfiles.specialties})`);
    }
    
    if (filters?.location) {
      conditions.push(like(professionalProfiles.location, `%${filters.location}%`));
    }
    
    return await db.select()
      .from(professionalProfiles)
      .where(and(...conditions))
      .orderBy(desc(professionalProfiles.rating), desc(professionalProfiles.totalReviews))
      .limit(filters?.limit || 20)
      .offset(filters?.offset || 0);
  }

  async getProfessional(id: number): Promise<ProfessionalProfile | undefined> {
    const [professional] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.id, id));
    return professional;
  }

  async getProfessionalByUserId(userId: string): Promise<ProfessionalProfile | undefined> {
    const [professional] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, userId));
    return professional;
  }

  async createProfessionalProfile(profileData: InsertProfessionalProfile): Promise<ProfessionalProfile> {
    const [profile] = await db.insert(professionalProfiles).values(profileData).returning();
    return profile;
  }

  async updateProfessionalProfile(id: number, profileData: Partial<InsertProfessionalProfile>): Promise<ProfessionalProfile> {
    const [profile] = await db
      .update(professionalProfiles)
      .set({ ...profileData, updatedAt: new Date() })
      .where(eq(professionalProfiles.id, id))
      .returning();
    return profile;
  }

  // Professional services
  async getProfessionalServices(professionalId: number): Promise<ProfessionalService[]> {
    return await db.select()
      .from(professionalServices)
      .where(and(
        eq(professionalServices.professionalId, professionalId),
        eq(professionalServices.isActive, true)
      ))
      .orderBy(asc(professionalServices.category), asc(professionalServices.title));
  }

  async createProfessionalService(serviceData: InsertProfessionalService): Promise<ProfessionalService> {
    const [service] = await db.insert(professionalServices).values(serviceData).returning();
    return service;
  }

  async updateProfessionalService(id: number, serviceData: Partial<InsertProfessionalService>): Promise<ProfessionalService> {
    const [service] = await db
      .update(professionalServices)
      .set({ ...serviceData, updatedAt: new Date() })
      .where(eq(professionalServices.id, id))
      .returning();
    return service;
  }

  // Service bookings
  async createServiceBooking(bookingData: InsertServiceBooking): Promise<ServiceBooking> {
    const [booking] = await db.insert(serviceBookings).values(bookingData).returning();
    return booking;
  }

  async getProfessionalBookings(professionalId: number): Promise<ServiceBooking[]> {
    return await db.select()
      .from(serviceBookings)
      .where(eq(serviceBookings.professionalId, professionalId))
      .orderBy(desc(serviceBookings.scheduledDate));
  }

  async getClientBookings(clientId: string): Promise<ServiceBooking[]> {
    return await db.select()
      .from(serviceBookings)
      .where(eq(serviceBookings.clientId, clientId))
      .orderBy(desc(serviceBookings.scheduledDate));
  }
}

export const storage = new DatabaseStorage();
