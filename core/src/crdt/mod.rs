//! CRDT (Conflict-free Replicated Data Types) implementations
//!
//! This module contains various CRDT data structures for building collaborative
//! applications without requiring coordination between replicas.
//!
//! # CRDTs Implemented (feature-gated)
//!
//! - **PN-Counter:** Positive-Negative Counter (`feature = "counters"`)
//! - **OR-Set:** Observed-Remove Set (`feature = "sets"`)
//! - **Fractional Index:** Position-based ordering (`feature = "fractional-index"`)
//! - **Text CRDT:** YATA-style collaborative text (`feature = "text-crdt"`)
//!
//! # Usage
//!
//! Enable features in your Cargo.toml:
//! ```toml
//! synckit-core = { version = "0.1", features = ["text-crdt"] }
//! ```
//!
//! # References
//!
//! - "A comprehensive study of CRDTs" by Marc Shapiro et al.
//! - "Conflict-free Replicated Data Types" (INRIA Research Report 7687)
//! - "Near Real-Time Peer-to-Peer Shared Editing on Extensible Data Types" (YATA)

// Conditionally compile each CRDT based on features
#[cfg(feature = "counters")]
pub mod pn_counter;

#[cfg(feature = "sets")]
pub mod or_set;

#[cfg(feature = "fractional-index")]
pub mod fractional_index;

#[cfg(feature = "text-crdt")]
pub mod text;

// Re-exports (only if features enabled)
#[cfg(feature = "counters")]
pub use pn_counter::PNCounter;

#[cfg(feature = "sets")]
pub use or_set::ORSet;

#[cfg(feature = "fractional-index")]
pub use fractional_index::FractionalIndex;

#[cfg(feature = "text-crdt")]
pub use text::Text;
