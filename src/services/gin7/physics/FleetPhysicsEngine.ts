/**
 * FleetPhysicsEngine
 * 
 * Physics engine for realtime fleet combat
 * Handles position updates, collision detection, and range calculations
 */

import { IVector3, IRealtimeCombatState } from '../../../models/gin7/Fleet';

/**
 * Vector3 utility functions
 */
export class Vector3 {
  /**
   * Create a zero vector
   */
  static zero(): IVector3 {
    return { x: 0, y: 0, z: 0 };
  }

  /**
   * Create a vector from components
   */
  static create(x: number, y: number, z: number = 0): IVector3 {
    return { x, y, z };
  }

  /**
   * Clone a vector
   */
  static clone(v: IVector3): IVector3 {
    return { x: v.x, y: v.y, z: v.z };
  }

  /**
   * Add two vectors
   */
  static add(a: IVector3, b: IVector3): IVector3 {
    return {
      x: a.x + b.x,
      y: a.y + b.y,
      z: a.z + b.z
    };
  }

  /**
   * Subtract vector b from a
   */
  static subtract(a: IVector3, b: IVector3): IVector3 {
    return {
      x: a.x - b.x,
      y: a.y - b.y,
      z: a.z - b.z
    };
  }

  /**
   * Multiply vector by scalar
   */
  static multiply(v: IVector3, scalar: number): IVector3 {
    return {
      x: v.x * scalar,
      y: v.y * scalar,
      z: v.z * scalar
    };
  }

  /**
   * Divide vector by scalar
   */
  static divide(v: IVector3, scalar: number): IVector3 {
    if (scalar === 0) return Vector3.zero();
    return {
      x: v.x / scalar,
      y: v.y / scalar,
      z: v.z / scalar
    };
  }

  /**
   * Calculate magnitude (length) of vector
   */
  static magnitude(v: IVector3): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  /**
   * Calculate squared magnitude (faster, no sqrt)
   */
  static magnitudeSquared(v: IVector3): number {
    return v.x * v.x + v.y * v.y + v.z * v.z;
  }

  /**
   * Normalize vector (make unit length)
   */
  static normalize(v: IVector3): IVector3 {
    const mag = Vector3.magnitude(v);
    if (mag === 0) return Vector3.zero();
    return Vector3.divide(v, mag);
  }

  /**
   * Calculate dot product
   */
  static dot(a: IVector3, b: IVector3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  /**
   * Calculate cross product
   */
  static cross(a: IVector3, b: IVector3): IVector3 {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  /**
   * Calculate distance between two points
   */
  static distance(a: IVector3, b: IVector3): number {
    return Vector3.magnitude(Vector3.subtract(b, a));
  }

  /**
   * Calculate squared distance (faster, no sqrt)
   */
  static distanceSquared(a: IVector3, b: IVector3): number {
    return Vector3.magnitudeSquared(Vector3.subtract(b, a));
  }

  /**
   * Linear interpolation between two vectors
   */
  static lerp(a: IVector3, b: IVector3, t: number): IVector3 {
    t = Math.max(0, Math.min(1, t));
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t
    };
  }

  /**
   * Create direction vector from heading angle (2D, XY plane)
   */
  static fromHeading(heading: number): IVector3 {
    const rad = (heading * Math.PI) / 180;
    return {
      x: Math.cos(rad),
      y: Math.sin(rad),
      z: 0
    };
  }

  /**
   * Convert vector to heading angle (2D, XY plane)
   */
  static toHeading(v: IVector3): number {
    let angle = (Math.atan2(v.y, v.x) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    return angle;
  }

  /**
   * Clamp vector magnitude
   */
  static clampMagnitude(v: IVector3, maxMagnitude: number): IVector3 {
    const mag = Vector3.magnitude(v);
    if (mag <= maxMagnitude) return v;
    return Vector3.multiply(Vector3.normalize(v), maxMagnitude);
  }

  /**
   * Check if two vectors are approximately equal
   */
  static equals(a: IVector3, b: IVector3, epsilon: number = 0.0001): boolean {
    return (
      Math.abs(a.x - b.x) < epsilon &&
      Math.abs(a.y - b.y) < epsilon &&
      Math.abs(a.z - b.z) < epsilon
    );
  }

  /**
   * Round vector components to decimal places
   */
  static round(v: IVector3, decimals: number = 2): IVector3 {
    const factor = Math.pow(10, decimals);
    return {
      x: Math.round(v.x * factor) / factor,
      y: Math.round(v.y * factor) / factor,
      z: Math.round(v.z * factor) / factor
    };
  }
}

/**
 * Collision result
 */
export interface CollisionResult {
  collided: boolean;
  distance: number;
  penetrationDepth?: number;
  normal?: IVector3;
}

/**
 * Fleet physics state (runtime, not stored)
 */
export interface FleetPhysicsState {
  fleetId: string;
  combat: IRealtimeCombatState;
  collisionRadius: number;
  mass: number;
}

/**
 * FleetPhysicsEngine class
 */
export class FleetPhysicsEngine {
  // Default values
  static readonly DEFAULT_COLLISION_RADIUS = 50;
  static readonly DEFAULT_MASS = 1000;
  static readonly DEFAULT_DRAG = 0.98;  // Velocity damping per tick
  static readonly DEFAULT_MAX_SPEED = 20;
  static readonly DEFAULT_ACCELERATION = 2;
  static readonly DEFAULT_TURN_RATE = 10;  // degrees per tick

  /**
   * Update fleet position based on velocity
   * @param state Fleet physics state
   * @param deltaTime Time delta in ticks (usually 1)
   * @returns Updated position
   */
  static updatePosition(state: FleetPhysicsState, deltaTime: number = 1): IVector3 {
    const { combat } = state;
    
    // New position = current position + velocity * deltaTime
    const newPosition = Vector3.add(
      combat.position,
      Vector3.multiply(combat.velocity, deltaTime)
    );
    
    // Update the state
    combat.position = Vector3.round(newPosition, 2);
    
    return combat.position;
  }

  /**
   * Apply acceleration to velocity
   * @param state Fleet physics state
   * @param direction Direction to accelerate (normalized)
   * @param power Acceleration power (0-1)
   */
  static applyAcceleration(
    state: FleetPhysicsState,
    direction: IVector3,
    power: number = 1
  ): void {
    const { combat } = state;
    
    // Calculate acceleration
    const accelMagnitude = combat.acceleration * power;
    const accel = Vector3.multiply(Vector3.normalize(direction), accelMagnitude);
    
    // Add to velocity
    let newVelocity = Vector3.add(combat.velocity, accel);
    
    // Clamp to max speed
    newVelocity = Vector3.clampMagnitude(newVelocity, combat.maxSpeed);
    
    combat.velocity = newVelocity;
    combat.speed = Vector3.magnitude(newVelocity);
  }

  /**
   * Apply drag to velocity (slowdown)
   * @param state Fleet physics state
   * @param drag Drag coefficient (0-1, lower = more drag)
   */
  static applyDrag(state: FleetPhysicsState, drag: number = FleetPhysicsEngine.DEFAULT_DRAG): void {
    const { combat } = state;
    combat.velocity = Vector3.multiply(combat.velocity, drag);
    combat.speed = Vector3.magnitude(combat.velocity);
    
    // Stop if very slow
    if (combat.speed < 0.01) {
      combat.velocity = Vector3.zero();
      combat.speed = 0;
    }
  }

  /**
   * Move fleet toward a target position
   * @param state Fleet physics state
   * @param targetPosition Target position to move toward
   * @param deltaTime Time delta in ticks
   * @returns True if reached target
   */
  static moveToward(
    state: FleetPhysicsState,
    targetPosition: IVector3,
    deltaTime: number = 1
  ): boolean {
    const { combat } = state;
    
    const toTarget = Vector3.subtract(targetPosition, combat.position);
    const distance = Vector3.magnitude(toTarget);
    
    // Check if close enough
    const stoppingDistance = combat.speed * 3;  // Distance to start slowing down
    if (distance < 1) {
      combat.velocity = Vector3.zero();
      combat.speed = 0;
      combat.position = Vector3.clone(targetPosition);
      return true;
    }
    
    // Calculate target heading
    const targetHeading = Vector3.toHeading(toTarget);
    combat.targetHeading = targetHeading;
    
    // Update heading (turn toward target)
    this.updateHeading(state, targetHeading, deltaTime);
    
    // Only accelerate if facing roughly the right direction
    const headingDiff = Math.abs(this.normalizeAngle(targetHeading - combat.heading));
    if (headingDiff < 45) {
      // Slow down when approaching target
      const power = distance < stoppingDistance ? distance / stoppingDistance : 1;
      const direction = Vector3.fromHeading(combat.heading);
      this.applyAcceleration(state, direction, power);
    }
    
    // Update position
    this.updatePosition(state, deltaTime);
    
    return false;
  }

  /**
   * Update fleet heading (rotation)
   * @param state Fleet physics state
   * @param targetHeading Target heading in degrees (0-360)
   * @param deltaTime Time delta in ticks
   * @returns True if reached target heading
   */
  static updateHeading(
    state: FleetPhysicsState,
    targetHeading: number,
    deltaTime: number = 1
  ): boolean {
    const { combat } = state;
    
    // Normalize angles
    const current = this.normalizeAngle(combat.heading);
    const target = this.normalizeAngle(targetHeading);
    
    // Calculate shortest rotation direction
    let diff = target - current;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    
    // Check if close enough
    if (Math.abs(diff) < 0.5) {
      combat.heading = target;
      combat.angularVelocity = 0;
      return true;
    }
    
    // Calculate rotation amount
    const maxRotation = combat.turnRate * deltaTime;
    const rotation = Math.sign(diff) * Math.min(Math.abs(diff), maxRotation);
    
    // Update heading
    combat.heading = this.normalizeAngle(current + rotation);
    combat.angularVelocity = rotation / deltaTime;
    
    return false;
  }

  /**
   * Normalize angle to 0-360 range
   */
  static normalizeAngle(angle: number): number {
    angle = angle % 360;
    if (angle < 0) angle += 360;
    return angle;
  }

  /**
   * Calculate distance between two positions
   */
  static calculateDistance(pos1: IVector3, pos2: IVector3): number {
    return Vector3.distance(pos1, pos2);
  }

  /**
   * Check if target is in weapon range
   * @param attackerPos Attacker position
   * @param targetPos Target position
   * @param weaponRange Weapon range
   * @returns True if in range
   */
  static isInRange(
    attackerPos: IVector3,
    targetPos: IVector3,
    weaponRange: number
  ): boolean {
    // Use squared distance for performance
    const distSq = Vector3.distanceSquared(attackerPos, targetPos);
    return distSq <= weaponRange * weaponRange;
  }

  /**
   * Check collision between two fleets
   * @param fleet1 First fleet state
   * @param fleet2 Second fleet state
   * @returns Collision result
   */
  static checkCollision(
    fleet1: FleetPhysicsState,
    fleet2: FleetPhysicsState
  ): CollisionResult {
    const distance = Vector3.distance(fleet1.combat.position, fleet2.combat.position);
    const minDistance = fleet1.collisionRadius + fleet2.collisionRadius;
    
    if (distance >= minDistance) {
      return { collided: false, distance };
    }
    
    const normal = Vector3.normalize(
      Vector3.subtract(fleet2.combat.position, fleet1.combat.position)
    );
    
    return {
      collided: true,
      distance,
      penetrationDepth: minDistance - distance,
      normal
    };
  }

  /**
   * Resolve collision between two fleets (push apart)
   * @param fleet1 First fleet state
   * @param fleet2 Second fleet state
   * @param collision Collision result
   */
  static resolveCollision(
    fleet1: FleetPhysicsState,
    fleet2: FleetPhysicsState,
    collision: CollisionResult
  ): void {
    if (!collision.collided || !collision.normal || !collision.penetrationDepth) return;
    
    // Calculate mass ratio for push
    const totalMass = fleet1.mass + fleet2.mass;
    const ratio1 = fleet2.mass / totalMass;
    const ratio2 = fleet1.mass / totalMass;
    
    // Push fleets apart
    const push = Vector3.multiply(collision.normal, collision.penetrationDepth);
    fleet1.combat.position = Vector3.subtract(
      fleet1.combat.position,
      Vector3.multiply(push, ratio1)
    );
    fleet2.combat.position = Vector3.add(
      fleet2.combat.position,
      Vector3.multiply(push, ratio2)
    );
  }

  /**
   * Check if position is within battle area
   */
  static isInBattleArea(
    position: IVector3,
    area: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }
  ): boolean {
    return (
      position.x >= area.minX && position.x <= area.maxX &&
      position.y >= area.minY && position.y <= area.maxY &&
      position.z >= area.minZ && position.z <= area.maxZ
    );
  }

  /**
   * Clamp position to battle area
   */
  static clampToBattleArea(
    position: IVector3,
    area: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }
  ): IVector3 {
    return {
      x: Math.max(area.minX, Math.min(area.maxX, position.x)),
      y: Math.max(area.minY, Math.min(area.maxY, position.y)),
      z: Math.max(area.minZ, Math.min(area.maxZ, position.z))
    };
  }

  /**
   * Calculate angle from one position to another
   */
  static angleToTarget(from: IVector3, to: IVector3): number {
    const direction = Vector3.subtract(to, from);
    return Vector3.toHeading(direction);
  }

  /**
   * Calculate if target is in front of the fleet (within cone)
   * @param state Fleet physics state
   * @param targetPos Target position
   * @param coneAngle Cone half-angle in degrees (default 45 = 90 degree cone)
   */
  static isTargetInFront(
    state: FleetPhysicsState,
    targetPos: IVector3,
    coneAngle: number = 45
  ): boolean {
    const { combat } = state;
    const toTarget = Vector3.subtract(targetPos, combat.position);
    const targetHeading = Vector3.toHeading(toTarget);
    const diff = Math.abs(this.normalizeAngle(targetHeading - combat.heading));
    return diff <= coneAngle || diff >= 360 - coneAngle;
  }

  /**
   * Create default physics state from fleet data
   */
  static createDefaultState(
    fleetId: string,
    position: IVector3 = Vector3.zero(),
    options: Partial<{
      heading: number;
      maxSpeed: number;
      acceleration: number;
      turnRate: number;
      collisionRadius: number;
      mass: number;
    }> = {}
  ): FleetPhysicsState {
    return {
      fleetId,
      combat: {
        position: Vector3.clone(position),
        velocity: Vector3.zero(),
        heading: options.heading ?? 0,
        angularVelocity: 0,
        speed: 0,
        maxSpeed: options.maxSpeed ?? this.DEFAULT_MAX_SPEED,
        acceleration: options.acceleration ?? this.DEFAULT_ACCELERATION,
        turnRate: options.turnRate ?? this.DEFAULT_TURN_RATE
      },
      collisionRadius: options.collisionRadius ?? this.DEFAULT_COLLISION_RADIUS,
      mass: options.mass ?? this.DEFAULT_MASS
    };
  }
}

export default FleetPhysicsEngine;
