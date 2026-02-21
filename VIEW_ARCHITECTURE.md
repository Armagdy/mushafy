# View-Based Configuration Architecture

## Overview

The Mushafy Quran application uses a **View-based architecture** for all configuration and settings screens, replacing traditional modal dialogs. This document explains the architecture, design decisions, and implementation patterns.

## Table of Contents

- [Why Views Instead of Dialogs?](#why-views-instead-of-dialogs)
- [Architecture Components](#architecture-components)
- [View Component Structure](#view-component-structure)
- [Styling Standards](#styling-standards)
- [State Management](#state-management)
- [Navigation Flow](#navigation-flow)
- [Migration Guide](#migration-guide)
- [Best Practices](#best-practices)

## Why Views Instead of Dialogs?

### Problems with Modal Dialogs

The application originally used modal dialogs (shadcn/ui Dialog components) for settings, bookmarks, navigation, etc. This approach had several drawbacks:

❌ **Mobile UX Issues**
- Dialogs felt cramped on small screens
- Limited scrollable area within dialog
- Modal backdrop reduced Quran page visibility
- Difficult to design touch-friendly interfaces in constrained space

❌ **Navigation Complexity**
- No easy way to switch between related configuration screens
- Each dialog required separate state management
- Opening one dialog meant closing another
- Poor discoverability of features

❌ **Styling Inconsistency**
- Each dialog styled differently
- Difficult to maintain consistent UX
- Responsive behavior varied across dialogs

❌ **Maintenance Overhead**
- Duplicate logic across dialogs
- State synchronization issues
- Testing complexity

### Benefits of View Architecture

✅ **Superior Mobile Experience**
- Full-screen immersive interface
- Maximum content area
- Natural swipe/tap interactions
- No backdrop blocking Quran content

✅ **Seamless Navigation**
- Bottom bar enables instant view switching
- Related features easily accessible
- Consistent navigation pattern
- Better feature discoverability

✅ **Unified Styling**
- Single source of truth for styling
- Consistent header/footer across views
- Predictable responsive behavior
- Easier to maintain design system

✅ **Simplified State Management**
- Single ConfigOverlay manages all views
- No multiple dialog open/close states
- Props passed from parent once
- Easier testing and debugging

## Architecture Components

### 1. ConfigOverlay (Container)

**File:** `src/components/config/ConfigOverlay.tsx`

The main container component that manages all configuration views.

#### Responsibilities

- **View Rendering**: Switches between different view components based on `type` prop
- **Header Management**: Displays consistent emerald gradient header with back button
- **Bottom Navigation**: Integrates BottomBar for view switching
- **State Passing**: Forwards props from parent (Surah.tsx) to child views
- **Lifecycle Management**: Handles Android back button, safe area insets, scroll position

#### Key Props

```typescript
interface ConfigOverlayProps {
  type: ConfigType;  // 'settings' | 'bookmarks' | 'navigation' | ...
  onClose: () => void;  // Called when user exits overlay
  onChangeView: (view: ConfigType) => void;  // Navigate to different view
  
  // Data props passed to views
  currentPage: number;
  currentSurahId: number;
  viewMode: 'single' | 'double';
  // ... many more props for different views
}
```

#### Structure

```tsx
<div className="fixed inset-0 z-50 flex flex-col bg-[#FBF9F4]">
  {/* Header with close button and title */}
  <div className="sticky top-0 bg-gradient-to-b from-emerald-800 to-emerald-600">
    <Button onClick={onClose}>Close</Button>
    <h1>{getTitle()}</h1>
  </div>
  
  {/* Scrollable content area */}
  <div className="flex-1 overflow-y-auto pb-20">
    {renderView()}  {/* Renders current view component */}
  </div>
  
  {/* Bottom navigation bar */}
  <div className="fixed bottom-0">
    <BottomBar onGoToClick={...} onSearchClick={...} />
  </div>
</div>
```

#### View Switching Logic

```typescript
const renderView = () => {
  switch (type) {
    case 'settings':
      return <SettingsView />;
    case 'bookmarks':
      return <BookmarksView {...bookmarkProps} />;
    case 'navigation':
      return <NavigationView onNavigate={...} onClose={onClose} />;
    // ... other cases
    default:
      return null;
  }
};
```

### 2. View Components (Panels)

**Directory:** `src/components/config/`

Self-contained configuration panels that handle specific features.

#### Available Views

| View | File | Purpose | Key Features |
|------|------|---------|--------------|
| **Settings** | `SettingsView.tsx` | App preferences | Language, Mushaf type, view mode, page loading, bottom bar text |
| **Bookmarks** | `BookmarksView.tsx` | Bookmark management | Three tabbed types (general, memorization, reading), CRUD operations |
| **Navigation** | `NavigationView.tsx` | Location jumping | Navigate by Surah, Juz, Page, Hizb, Quarter, or specific Ayah |
| **Search** | `SearchView.tsx` | Text search | Search Quran by word, view results with highlighting |
| **Reciter** | `ReciterView.tsx` | Audio settings | Choose reciter, filter by reading/style/quality, toggle audio source |
| **Tafseer** | `TafseerView.tsx` | Tafseer selection | Select from 20+ tafseer sources in multiple languages |
| **Repeat** | `RepeatView.tsx` | Memorization | Configure passage/ayah repeat counts, set range |

#### Common Characteristics

All view components follow these patterns:

1. **Props Interface**: Typed props with `onClose` callback
2. **Hooks**: Use `useLanguage()` and `useDialogTextSize()` for localization and responsive text
3. **Layout**: Consistent padding and spacing (`p-4`, `space-y-2`)
4. **RTL Support**: Conditionally apply RTL/LTR direction
5. **Responsive Design**: Mobile-first with breakpoint-based styling

### 3. BottomBar (Navigation)

**File:** `src/components/quran/BottomBar.tsx`

The bottom navigation bar appears in both:
- Main Surah view (triggers ConfigOverlay opening)
- ConfigOverlay (switches between views)

#### Icons and Actions

```tsx
<BottomBar
  onGoToClick={() => setConfigOverlayType('navigation')}
  onSearchClick={() => setConfigOverlayType('search')}
  onBookmarkClick={() => setConfigOverlayType('bookmarks')}
  onSettingsClick={() => setConfigOverlayType('settings')}
  onTafseerClick={() => setConfigOverlayType('tafseer')}
  onViewModeToggle={toggleViewMode}  // Double/single page
/>
```

## View Component Structure

### Standard Template

```tsx
// src/components/config/ExampleView.tsx
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface ExampleViewProps {
  onClose: () => void;  // Required for actions that exit the overlay
  // Data props
  currentData: string;
  // Callback props
  onDataChange: (value: string) => void;
}

export default function ExampleView({ 
  onClose, 
  currentData,
  onDataChange 
}: ExampleViewProps) {
  // 1. Hooks for localization and text sizing
  const { t, isRTL } = useLanguage();
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
  
  // 2. Local state (if needed)
  const [localValue, setLocalValue] = useState(currentData);
  
  // 3. Event handlers
  const handleSave = () => {
    onDataChange(localValue);
    onClose();  // Close overlay after action
  };
  
  // 4. Render with consistent structure
  return (
    <div className={cn("p-4 space-y-2 sm:space-y-3", isRTL ? "rtl" : "ltr")}>
      {/* Section Header */}
      <div className="space-y-1">
        <h2 className={cn("font-semibold text-emerald-800", textSizeClasses.title)}>
          {t('sectionTitle')}
        </h2>
        <p className={cn("text-emerald-600", textSizeClasses.text)}>
          {t('sectionDescription')}
        </p>
      </div>
      
      {/* Content */}
      <div className="space-y-2">
        <Label className={cn("font-medium text-emerald-800", textSizeClasses.label)}>
          {t('fieldLabel')}
        </Label>
        {/* Input, Select, Tabs, etc. */}
      </div>
      
      {/* Action Buttons */}
      <div className="flex gap-2 justify-end">
        <Button 
          onClick={handleSave}
          className={cn("bg-emerald-700 hover:bg-emerald-800 text-[#F2E3BB]", textSizeClasses.text)}
        >
          {t('save')}
        </Button>
      </div>
    </div>
  );
}
```

### Key Sections

#### 1. Imports
```tsx
// Core React
import { useState, useEffect } from 'react';

// Contexts
import { useLanguage } from "@/contexts/LanguageContext";
import { useDialogTextSize, getDialogTextSizeClasses } from "@/contexts/DialogTextSizeContext";

// UI Components
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Icons
import { Plus, Trash2, Edit } from "lucide-react";

// Utilities
import { cn } from "@/lib/utils";
```

#### 2. Props Interface
```tsx
interface ViewProps {
  onClose: () => void;  // CRITICAL: Always include for actions that should exit overlay
  // Separate data props from callback props
  data: DataType;
  items: ItemType[];
  // Callbacks
  onUpdate: (value: ValueType) => void;
  onDelete: (id: string) => void;
}
```

#### 3. Component Logic
```tsx
export default function MyView({ onClose, ...props }: ViewProps) {
  // Hooks
  const { t, isRTL } = useLanguage();
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
  
  // Local state
  const [activeTab, setActiveTab] = useState('tab1');
  
  // Effects (e.g., persistence, data loading)
  useEffect(() => {
    localStorage.setItem('my-view-tab', activeTab);
  }, [activeTab]);
  
  // Event handlers
  const handleAction = () => {
    // Perform action
    onClose();  // Close overlay when appropriate
  };
  
  return (/* JSX */);
}
```

#### 4. JSX Structure
```tsx
return (
  <div className={cn("p-4 space-y-2 sm:space-y-3", isRTL ? "rtl" : "ltr")}>
    {/* Tabbed interface (if multiple sections) */}
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>...</TabsList>
      <TabsContent>...</TabsContent>
    </Tabs>
    
    {/* OR sectioned content */}
    <div className="space-y-4">
      <section>
        <h3>{t('section1')}</h3>
        {/* Section content */}
      </section>
      
      <section>
        <h3>{t('section2')}</h3>
        {/* Section content */}
      </section>
    </div>
  </div>
);
```

## Styling Standards

### Color System

All views follow the emerald/cream color palette:

```tsx
// Primary colors
"bg-emerald-700"        // Button backgrounds
"text-emerald-800"      // Primary text
"text-emerald-600"      // Secondary/muted text
"border-emerald-300"    // Input borders
"text-[#F2E3BB]"        // Cream text on emerald backgrounds

// Interactive states
"hover:bg-emerald-800"  // Button hover
"focus:border-emerald-500"  // Input focus
"focus:ring-emerald-500"    // Focus ring
```

### Component Styles

#### Buttons
```tsx
// Primary button (solid emerald)
<Button className={cn(
  "bg-emerald-700 hover:bg-emerald-800 text-[#F2E3BB]",
  "rounded-lg border border-emerald-600 shadow-md",
  textSizeClasses.text
)}>
  {t('action')}
</Button>

// Ghost button (transparent)
<Button 
  variant="ghost"
  className="text-emerald-700 hover:bg-emerald-100"
>
  {t('cancel')}
</Button>
```

#### Inputs
```tsx
<Input 
  className={cn(
    "border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500",
    textSizeClasses.text
  )}
  placeholder={t('placeholder')}
/>
```

#### Labels
```tsx
<Label className={cn(
  "font-medium text-emerald-800",
  textSizeClasses.label
)}>
  {t('label')}
</Label>
```

#### Tabs
```tsx
<TabsList className="grid w-full grid-cols-2 h-11 md:h-12 bg-emerald-100 dark:bg-emerald-900/30">
  <TabsTrigger 
    value="tab1"
    className={cn(
      "data-[state=active]:bg-emerald-700 data-[state=active]:text-[#F2E3BB]",
      textSizeClasses.text
    )}
  >
    {t('tab1')}
  </TabsTrigger>
</TabsList>
```

#### Select Dropdowns
```tsx
<Select value={value} onValueChange={setValue}>
  <SelectTrigger className={cn(
    "border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500",
    textSizeClasses.text
  )}>
    <SelectValue />
  </SelectTrigger>
  <SelectContent className="bg-[#FBF9F4] dark:bg-emerald-950">
    <SelectItem 
      value="option1"
      className="focus:bg-emerald-100 focus:text-emerald-900"
    >
      {t('option1')}
    </SelectItem>
  </SelectContent>
</Select>
```

### Responsive Text Sizing

Use `getDialogTextSizeClasses()` for consistent sizing:

```tsx
const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);

// Available classes:
textSizeClasses.text   // "text-base md:text-xl" - body text
textSizeClasses.label  // "text-base md:text-xl" - labels
textSizeClasses.title  // "text-lg md:text-2xl" - section headers
```

### Layout & Spacing

```tsx
// View container
<div className="p-4 space-y-2 sm:space-y-3">

// Sections
<div className="space-y-4">

// Form groups
<div className="space-y-2">

// Button groups
<div className="flex gap-2 justify-end">
```

## State Management

### Parent State (Surah.tsx)

The parent component (Surah.tsx) manages:
- ConfigOverlay open/close state
- Current view type
- All data for views (bookmarks, settings, audio config, etc.)
- Callbacks for state updates

```tsx
// In Surah.tsx
const [configOverlayType, setConfigOverlayType] = useState<ConfigType | null>(null);

// Open overlay
<BottomBar onSettingsClick={() => setConfigOverlayType('settings')} />

// Render overlay
{configOverlayType && (
  <ConfigOverlay
    type={configOverlayType}
    onClose={() => setConfigOverlayType(null)}
    onChangeView={(view) => setConfigOverlayType(view)}
    // Forward all necessary props
    {...props}
  />
)}
```

### View State (Local)

Views can have local state for UI concerns:
- Active tab index
- Form input values (before save)
- Expanded/collapsed sections
- Filter values

```tsx
// Example: BookmarksView
const [activeTab, setActiveTab] = useState<'general' | 'memorization' | 'reading'>('general');
const [editingId, setEditingId] = useState<string | null>(null);

// Persist UI state
useEffect(() => {
  localStorage.setItem('bookmarks-active-tab', activeTab);
}, [activeTab]);
```

### Context Usage

Views consume global contexts:
- **LanguageContext**: `t()`, `isRTL`, `language`
- **DialogTextSizeContext**: `dialogTextSize`, responsive text classes
- **MushafContext**: Mushaf type (if needed for display)

## Navigation Flow

### Opening a View

1. **User interaction**: Tap bottom bar icon
2. **Parent state update**: `setConfigOverlayType('viewname')`
3. **ConfigOverlay renders**: Full-screen overlay appears
4. **View component renders**: Based on `type` prop
5. **URL unchanged**: Still on `/page/X` or `/surah/Y`

### Switching Views

1. **User taps different icon**: On bottom bar within overlay
2. **onChangeView callback**: `onChangeView('newview')`
3. **Parent state update**: `setConfigOverlayType('newview')`
4. **Re-render**: ConfigOverlay renders new view component
5. **Smooth transition**: No loading, instant switch

### Closing Overlay

Multiple ways to close:

```tsx
// 1. Close button in header
<Button onClick={onClose}>X</Button>

// 2. After completing action
const handleSave = () => {
  saveData();
  onClose();  // Close after save
};

// 3. After navigation
const handleNavigate = (page: number) => {
  onNavigate(page);
  onClose();  // Close to show new page
};

// 4. Android back button (handled in ConfigOverlay)
useEffect(() => {
  const handler = App.addListener('backButton', () => onClose());
  return () => handler.remove();
}, [onClose]);
```

## Migration Guide

### From Dialog to View

If you have an existing Dialog component, follow these steps:

#### 1. Create View File

```tsx
// Old: src/components/quran/MyFeatureDialog.tsx
// New: src/components/config/MyFeatureView.tsx

export default function MyFeatureView({ onClose, ...props }: MyFeatureViewProps) {
  // Convert dialog content to view format
}
```

#### 2. Remove Dialog Wrapper

```tsx
// OLD (Dialog):
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{t('title')}</DialogTitle>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>

// NEW (View):
<div className={cn("p-4 space-y-2 sm:space-y-3", isRTL ? "rtl" : "ltr")}>
  {/* Content - no dialog wrapper needed */}
</div>
```

#### 3. Update ConfigOverlay

```tsx
// Add to ConfigType union
export type ConfigType = '...' | 'myfeature';

// Add to renderView() switch
case 'myfeature':
  return <MyFeatureView onClose={onClose} {...props} />;

// Add to getTitle()
case 'myfeature':
  return t('myFeatureTitle');
```

#### 4. Update Trigger

```tsx
// OLD:
<Button onClick={() => setDialogOpen(true)}>

// NEW:
<Button onClick={() => setConfigOverlayType('myfeature')}>
```

#### 5. Update Translations

Ensure translation keys work with `t()` function:

```tsx
// src/i18n/translations.ts
export const translations = {
  ar: {
    myFeatureTitle: 'ميزتي',
    // ...
  },
  en: {
    myFeatureTitle: 'My Feature',
    // ...
  }
};
```

### Example: NavigationDialog → NavigationView

**Before (Dialog):**
```tsx
// NavigationDialog.tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-2xl">
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="surah">Surah</TabsTrigger>
        <TabsTrigger value="juz">Juz</TabsTrigger>
      </TabsList>
      <TabsContent value="surah">
        {/* Surah selector */}
      </TabsContent>
    </Tabs>
  </DialogContent>
</Dialog>
```

**After (View):**
```tsx
// NavigationView.tsx
export default function NavigationView({ onNavigate, onClose }: Props) {
  const { t, isRTL } = useLanguage();
  const { dialogTextSize } = useDialogTextSize();
  const textSizeClasses = getDialogTextSizeClasses(dialogTextSize);
  
  return (
    <div className={cn("p-4 space-y-2 sm:space-y-3", isRTL ? "rtl" : "ltr")}>
      <Tabs value={tab} onValueChange={setTab}>
        {/* Same content, different container */}
      </Tabs>
    </div>
  );
}
```

## Best Practices

### DO ✅

1. **Always use `t()` for text**
   ```tsx
   <h2>{t('title')}</h2>  // ✅
   <h2>Title</h2>         // ❌
   ```

2. **Include `onClose` prop for actions that should exit**
   ```tsx
   const handleSave = () => {
     saveData();
     onClose();  // ✅
   };
   ```

3. **Use `textSizeClasses` for responsive text**
   ```tsx
   <Label className={textSizeClasses.label}>{t('label')}</Label>  // ✅
   ```

4. **Apply RTL direction**
   ```tsx
   <div className={cn("p-4", isRTL ? "rtl" : "ltr")}>  // ✅
   ```

5. **Use emerald color system**
   ```tsx
   className="bg-emerald-700 text-[#F2E3BB]"  // ✅
   ```

6. **Preserve Arabic font for Quranic text**
   ```tsx
   <span className="font-arabic">{ayahText}</span>  // ✅
   ```

### DON'T ❌

1. **Don't create inline dialogs**
   ```tsx
   // ❌ Wrong
   return (
     <div>
       <Dialog>...</Dialog>
     </div>
   );
   
   // ✅ Correct
   // Create separate View component in src/components/config/
   ```

2. **Don't hardcode strings**
   ```tsx
   <Button>Save</Button>  // ❌
   <Button>{t('save')}</Button>  // ✅
   ```

3. **Don't use inconsistent colors**
   ```tsx
   className="bg-blue-500"  // ❌
   className="bg-emerald-700"  // ✅
   ```

4. **Don't forget RTL support**
   ```tsx
   <div className="text-left">  // ❌
   <div className={cn(isRTL ? "text-right" : "text-left")}>  // ✅
   ```

5. **Don't use absolute positioning (except for overlays)**
   ```tsx
   className="absolute top-0"  // ❌ Inside views
   className="relative"  // ✅
   ```

6. **Don't mutate props directly**
   ```tsx
   props.items.push(newItem);  // ❌
   onAddItem(newItem);  // ✅
   ```

### Performance Tips

1. **Memoize expensive computations**
   ```tsx
   const filteredItems = useMemo(
     () => items.filter(filterFn),
     [items, filterFn]
   );
   ```

2. **Lazy load data when view opens**
   ```tsx
   useEffect(() => {
     fetchData();
   }, []);  // Run once on mount
   ```

3. **Debounce search inputs**
   ```tsx
   const debouncedSearch = useMemo(
     () => debounce(handleSearch, 300),
     []
   );
   ```

### Accessibility

1. **Add ARIA labels**
   ```tsx
   <Button aria-label={t('closeSettings')} onClick={onClose}>
     <X />
   </Button>
   ```

2. **Use semantic HTML**
   ```tsx
   <nav>  // ✅ For BottomBar
   <main>  // ✅ For view content
   <button>  // ✅ Not <div onClick>
   ```

3. **Ensure keyboard navigation**
   ```tsx
   <Button onKeyDown={handleKeyDown}>
   ```

## Conclusion

The View-based architecture provides a modern, mobile-first approach to configuration UIs in the Mushafy Quran application. By following these patterns and standards, new features integrate seamlessly with the existing design system while providing an excellent user experience.

**Key Takeaways:**
- Views replace modal dialogs for all configuration
- ConfigOverlay manages view lifecycle and navigation
- Consistent styling with emerald/cream color palette
- RTL support and responsive text sizing built-in
- State managed by parent component (Surah.tsx)
- Each view is self-contained and reusable

For questions or additions to this documentation, please refer to the project's copilot instructions or main README.
