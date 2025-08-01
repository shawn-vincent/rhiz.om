# Floating Orbs Video Background Implementation Proposal
**Date:** July 31, 2025  
**Context:** Technical Implementation Planning  
**Status:** Detailed Proposal - Ready for Development

## Executive Summary

This document outlines a comprehensive implementation strategy for the floating orbs video background system in rhiz.om. The proposal integrates physics-based animations with React Spring, leverages existing VideoAvatar components, and provides an elegant toggle mechanism between chat-focused and video-focused viewing modes.

## Current Architecture Analysis

### Existing Components & Infrastructure

**VideoAvatar Component** (`src/components/ui/video-avatar.tsx`):
- ✅ **Unified Design**: Handles both local and remote participants seamlessly
- ✅ **LiveKit Integration**: Native track management with comprehensive event listeners
- ✅ **Circular Design**: Perfect foundation for orb-based layout
- ✅ **Size System**: Configurable sizing (sm: 32px, md: 40px, lg: 48px)
- ✅ **Performance Optimized**: Uses LiveKit's attach/detach methods efficiently

**Sync System** (`src/hooks/use-sync.ts`):
- ✅ **Real-time Participant Tracking**: useSync provides live room state
- ✅ **Being/Intention Data**: Comprehensive participant information
- ✅ **Connection State**: isConnected status for UI feedback
- ✅ **Modular Architecture**: Clean separation of concerns

**Chat Architecture** (`src/app/_components/chat.tsx`):
- ✅ **Room Integration**: Already receives room prop from useSync
- ✅ **Responsive Layout**: Mobile/desktop adaptive design
- ✅ **Performance Optimized**: Efficient rendering and state management

### Technology Stack Assessment

**Current Dependencies** (from package.json analysis):
- ✅ **React 19**: Latest React features for optimal performance
- ✅ **Next.js 15**: App Router with advanced rendering capabilities
- ✅ **LiveKit Client**: Robust real-time video infrastructure
- ✅ **Tailwind CSS 4.0**: Modern utility-first styling system
- ✅ **TypeScript 5.8**: Strong type safety and developer experience

**Missing Dependencies** (to be added):
- 🔄 **@react-spring/web**: Physics-based animation library
- 🔄 **use-gesture**: Touch/mouse gesture handling
- 🔄 **lodash.throttle**: Performance optimization for animations

## Research-Informed Design Decisions

### Animation Library Selection: React Spring

**Rationale from Context7 Research:**
- **Physics-Based Animations**: React Spring provides natural spring physics that feel organic
- **Performance**: Uses imperative API to avoid React re-renders during animations
- **Gesture Integration**: Built-in support for drag, hover, and touch interactions
- **TypeScript Support**: Comprehensive type safety for complex animations

**Key React Spring Features for Floating Orbs:**
```typescript
// Physics configuration for natural movement
const springConfig = {
  mass: 1,           // Object weight (affects momentum)
  tension: 170,      // Spring strength (affects speed)
  friction: 26,      // Resistance (affects smoothness)
  precision: 0.001   // Animation completion threshold
}

// Imperative API for performance
const [springs, api] = useSpring(() => ({
  x: 0,
  y: 0,
  scale: 1,
  config: springConfig
}))
```

### Physics System Selection: Lightweight CSS-Based Approach

**Research Findings:**
- **Matter.js**: Too heavyweight for simple floating orbs (40% performance compared to Box2D.js)
- **P2.js**: Comprehensive but overkill for orbital movement
- **Custom Solution**: CSS transforms + React Spring provides optimal performance-to-complexity ratio

**Physics Implementation Strategy:**
- Use CSS `transform` property for GPU acceleration
- Implement soft collision detection with distance calculations
- Create orbital drift patterns using trigonometric functions
- Leverage React Spring's interpolation for smooth transitions

## Detailed UX Proposal

### Visual Design Specifications

**Orb Characteristics:**
- **Size Range**: Dynamic scaling from 80px (8+ participants) to 200px (2 participants)
- **Shape**: Perfect circles using `border-radius: 50%` with `overflow: hidden`
- **Video Treatment**: `object-fit: cover` for consistent circular cropping
- **Shadows**: Subtle `box-shadow` for depth perception
- **Glow Effects**: Animated `filter: blur()` for active speakers

**Movement Patterns:**
- **Idle State**: Gentle floating with 0.5-2px amplitude oscillations
- **Active State**: Slight pulsing scale animation (0.95x to 1.05x)
- **Speaking State**: Enhanced glow with 1.1x scale boost
- **Orbital Drift**: Slow circular movement preventing static clustering

**Visual Hierarchy:**
- **Active Speaker**: 15% larger scale with enhanced glow
- **Regular Participants**: Standard size with subtle shadow
- **Muted Participants**: 80% opacity with reduced presence
- **Disconnected**: 60% opacity with dimmed effects

### Interaction Design

**Primary Toggle Mechanism:**
```typescript
// Touch/click anywhere on background
const handleBackgroundToggle = useCallback((event: React.MouseEvent) => {
  if (event.target === backgroundRef.current) {
    setViewMode(current => current === 'chat' ? 'video' : 'chat')
  }
}, [])
```

**Secondary Controls:**
- **Keyboard**: `Space` key for desktop toggle
- **Gesture**: Two-finger tap on mobile for accessibility
- **Visual Feedback**: 200ms pulse animation on toggle

**Mode Transitions:**
```typescript
const modeTransition = useSpring({
  chatOpacity: viewMode === 'chat' ? 0.95 : 0.3,
  videoOpacity: viewMode === 'video' ? 1.0 : 0.7,
  config: { tension: 200, friction: 25 }
})
```

### Accessibility Considerations

**Keyboard Navigation:**
- Tab order maintains logical chat interaction flow
- Escape key returns to chat focus mode
- Arrow keys can navigate between video orbs when in video focus

**Screen Reader Support:**
- ARIA labels for each video orb with participant names
- Live region announcements for participant join/leave events
- Alternative text descriptions for visual state changes

**Motion Sensitivity:**
- `prefers-reduced-motion` detection reduces animation intensity
- Option to disable floating animations entirely
- Static positioning fallback maintaining circular layout

## Technical Architecture Proposal

### Component Structure

```
src/components/
├── ui/
│   ├── video-avatar.tsx (existing - minor enhancements)
│   └── floating-orbs-background.tsx (new)
├── chat/
│   ├── floating-video-overlay.tsx (new)
│   └── orb-physics-provider.tsx (new)
└── hooks/
    ├── use-orb-physics.ts (new)
    ├── use-participant-positions.ts (new)
    └── use-view-mode-toggle.ts (new)
```

### Core Implementation: FloatingOrbsBackground Component

```typescript
interface FloatingOrbsBackgroundProps {
  room: Room | null
  participants: BeingId[]
  viewMode: 'chat' | 'video'
  onToggleMode: () => void
  className?: string
}

export function FloatingOrbsBackground({
  room,
  participants,
  viewMode,
  onToggleMode,
  className
}: FloatingOrbsBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { orbPositions, updateOrbPosition } = useOrbPhysics(participants)
  
  // Physics-based positioning system
  const handleParticipantPositioning = useMemo(() => {
    return participants.map((participantId, index) => {
      const basePosition = generateOrbitalPosition(index, participants.length)
      const physicsPosition = orbPositions[participantId] || basePosition
      
      return {
        participantId,
        ...physicsPosition,
        size: calculateOrbSize(participants.length)
      }
    })
  }, [participants, orbPositions])

  return (
    <div 
      ref={containerRef}
      className={cn("fixed inset-0 pointer-events-none", className)}
      onClick={handleBackgroundToggle}
      style={{ zIndex: viewMode === 'video' ? 20 : 1 }}
    >
      {handleParticipantPositioning.map(({ participantId, x, y, size }) => (
        <FloatingOrb
          key={participantId}
          beingId={participantId}
          room={room}
          position={{ x, y }}
          size={size}
          viewMode={viewMode}
        />
      ))}
    </div>
  )
}
```

### Physics Hook: useOrbPhysics

```typescript
interface OrbPosition {
  x: number
  y: number
  vx: number  // velocity x
  vy: number  // velocity y
  targetX: number
  targetY: number
}

export function useOrbPhysics(participants: BeingId[]) {
  const [orbPositions, setOrbPositions] = useState<Record<BeingId, OrbPosition>>({})
  const animationFrameRef = useRef<number>()
  
  // Initialize positions for new participants
  useEffect(() => {
    const newPositions = { ...orbPositions }
    
    participants.forEach((participantId, index) => {
      if (!newPositions[participantId]) {
        const position = generateOrbitalPosition(index, participants.length)
        newPositions[participantId] = {
          ...position,
          vx: 0,
          vy: 0,
          targetX: position.x,
          targetY: position.y
        }
      }
    })
    
    setOrbPositions(newPositions)
  }, [participants])

  // Physics simulation loop
  useEffect(() => {
    const updatePhysics = () => {
      setOrbPositions(current => {
        const updated = { ...current }
        
        Object.keys(updated).forEach(participantId => {
          const orb = updated[participantId]
          
          // Soft springs toward target position
          const dx = orb.targetX - orb.x
          const dy = orb.targetY - orb.y
          
          // Apply spring forces
          orb.vx += dx * 0.05  // spring strength
          orb.vy += dy * 0.05
          
          // Apply damping
          orb.vx *= 0.95
          orb.vy *= 0.95
          
          // Update position
          orb.x += orb.vx
          orb.y += orb.vy
          
          // Collision detection with other orbs
          Object.keys(updated).forEach(otherId => {
            if (otherId !== participantId) {
              const other = updated[otherId]
              const distance = Math.sqrt(
                Math.pow(orb.x - other.x, 2) + Math.pow(orb.y - other.y, 2)
              )
              
              const minDistance = 120 // minimum separation
              if (distance < minDistance) {
                const angle = Math.atan2(orb.y - other.y, orb.x - other.x)
                const force = (minDistance - distance) * 0.5
                
                orb.vx += Math.cos(angle) * force
                orb.vy += Math.sin(angle) * force
              }
            }
          })
        })
        
        return updated
      })
      
      animationFrameRef.current = requestAnimationFrame(updatePhysics)
    }
    
    animationFrameRef.current = requestAnimationFrame(updatePhysics)
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [participants])

  return { orbPositions, setOrbPositions }
}
```

### Orbital Position Generation

```typescript
function generateOrbitalPosition(index: number, totalParticipants: number): { x: number, y: number } {
  const screenWidth = window.innerWidth
  const screenHeight = window.innerHeight
  
  // Create spiral pattern for natural distribution
  const angle = (index / totalParticipants) * Math.PI * 2
  const radius = Math.min(screenWidth, screenHeight) * (0.2 + (index % 3) * 0.15)
  
  const centerX = screenWidth * 0.5
  const centerY = screenHeight * 0.5
  
  return {
    x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 100,
    y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 100
  }
}

function calculateOrbSize(participantCount: number): number {
  // Dynamic sizing: more participants = smaller orbs
  const baseSize = 200
  const minSize = 80
  const scaleFactor = Math.max(0.4, 1 / Math.sqrt(participantCount))
  
  return Math.max(minSize, baseSize * scaleFactor)
}
```

### Integration with Chat Component

```typescript
// src/app/_components/chat.tsx modifications
export function Chat({ currentUserBeingId, beingId }: ChatProps) {
  const { beings: syncBeings, intentions: utterances, room } = useSync(beingId)
  const [viewMode, setViewMode] = useState<'chat' | 'video'>('chat')
  
  // Filter remote participants for floating orbs
  const remoteParticipants = useMemo(() => 
    syncBeings
      .filter(being => being.id !== currentUserBeingId)
      .map(being => being.id),
    [syncBeings, currentUserBeingId]
  )

  const handleToggleViewMode = useCallback(() => {
    setViewMode(current => current === 'chat' ? 'video' : 'chat')
  }, [])

  return (
    <ErrorBoundary>
      <div className="relative flex h-full w-full flex-col">
        {/* Floating Orbs Background */}
        <FloatingOrbsBackground
          room={room}
          participants={remoteParticipants}
          viewMode={viewMode}
          onToggleMode={handleToggleViewMode}
        />
        
        {/* Chat Interface with Dynamic Opacity */}
        <animated.div 
          style={{ 
            opacity: viewMode === 'chat' ? 0.95 : 0.3,
            backgroundColor: viewMode === 'chat' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)'
          }}
          className="relative z-10 flex h-full flex-col bg-white/20"
        >
          {/* Existing chat content */}
        </animated.div>
      </div>
    </ErrorBoundary>
  )
}
```

## Performance Optimization Strategy

### Animation Performance

**GPU Acceleration:**
- Use `transform` and `opacity` properties exclusively for animations
- Apply `will-change: transform` to orb elements during active animations
- Remove `will-change` after animations complete to preserve memory

**Frame Rate Optimization:**
```typescript
// Throttled physics updates for optimal performance
const useThrottledPhysics = (updateFn: () => void, fps: number = 60) => {
  const lastFrameTime = useRef(0)
  const frameInterval = 1000 / fps
  
  useEffect(() => {
    const update = (currentTime: number) => {
      if (currentTime - lastFrameTime.current >= frameInterval) {
        updateFn()
        lastFrameTime.current = currentTime
      }
      requestAnimationFrame(update)
    }
    requestAnimationFrame(update)
  }, [updateFn, frameInterval])
}
```

**Memory Management:**
- Lazy load orb components only when participants have video tracks
- Use `React.memo` for orb components to prevent unnecessary re-renders
- Implement cleanup for event listeners and animation frames

### Network & Resource Optimization

**Progressive Enhancement:**
- Load floating orbs system only when 2+ participants are present
- Graceful fallback to static avatars on low-performance devices
- Adaptive quality based on device capabilities

**Bundle Size Management:**
- Code-split React Spring components using dynamic imports
- Lazy load physics calculations until first video participant joins
- Tree-shake unused animation features

## Implementation Timeline

### Phase 1: Foundation (Week 1)
- [ ] Add React Spring and related dependencies
- [ ] Create basic FloatingOrbsBackground component structure
- [ ] Implement core positioning system without physics
- [ ] Basic toggle functionality between chat/video modes

### Phase 2: Physics Integration (Week 2)
- [ ] Implement useOrbPhysics hook with collision detection
- [ ] Add orbital drift patterns and soft spring animations
- [ ] Integrate with existing VideoAvatar components
- [ ] Performance optimization and frame rate limiting

### Phase 3: Enhancement & Polish (Week 3)
- [ ] Advanced visual effects (glow, active speaker highlighting)
- [ ] Gesture recognition and keyboard controls
- [ ] Accessibility features and screen reader support
- [ ] Mobile optimization and touch interactions

### Phase 4: Testing & Refinement (Week 4)
- [ ] Cross-browser compatibility testing
- [ ] Performance benchmarking on various devices
- [ ] User experience testing and feedback integration
- [ ] Documentation and code review

## Testing Strategy

### Unit Testing
- **Physics calculations**: Test orbital positioning and collision detection
- **Component rendering**: Verify orb positioning and video track attachment
- **Performance metrics**: Frame rate and memory usage benchmarks

### Integration Testing
- **LiveKit integration**: Video track state changes and room events
- **Chat interaction**: Toggle functionality and opacity transitions
- **Multi-participant scenarios**: 2, 5, 10, 15+ participant testing

### User Experience Testing
- **Accessibility**: Screen reader navigation and keyboard controls
- **Performance**: Testing on low-end devices and slow networks
- **Visual quality**: Video cropping and scaling across device sizes

## Success Metrics

### Technical Performance
- **Frame Rate**: Maintain 60fps on desktop, 30fps on mobile
- **Memory Usage**: <50MB additional memory footprint
- **CPU Impact**: <10% additional CPU usage during active animations

### User Experience
- **Toggle Response Time**: <200ms for mode switching
- **Video Quality**: Consistent circular cropping across all participants
- **Accessibility Score**: WCAG 2.1 AA compliance

### Feature Adoption
- **User Engagement**: Increased session duration with video features
- **Performance Metrics**: No degradation in chat responsiveness
- **Error Rates**: <0.1% animation-related errors

## Risk Mitigation

### Technical Risks
- **Performance Degradation**: Comprehensive testing on low-end devices
- **Browser Compatibility**: Progressive enhancement and fallbacks
- **Memory Leaks**: Strict cleanup protocols and monitoring

### User Experience Risks
- **Motion Sensitivity**: Reduced motion preferences and disable options
- **Cognitive Overload**: Clear visual hierarchy and intuitive controls
- **Accessibility Gaps**: Thorough testing with assistive technologies

## Conclusion

This implementation proposal leverages the existing rhiz.om architecture while introducing a sophisticated floating orbs video background system. The physics-based approach using React Spring provides natural, organic movement that aligns with the platform's aesthetic philosophy.

The technical design emphasizes performance, accessibility, and maintainability while delivering an immersive video experience that enhances rather than disrupts the core chat functionality. The phased implementation approach allows for iterative testing and refinement, ensuring a polished user experience upon release.

The floating orbs system represents a significant evolution in video-enabled chat interfaces, positioning rhiz.om as a leader in innovative, user-centered communication design.