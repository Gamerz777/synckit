//! CRDT (Conflict-free Replicated Data Types) implementations
//!
//! This module contains various CRDT data structures for building collaborative
//! applications without requiring coordination between replicas.
//!
//! # CRDTs Implemented
//!
//! - **PN-Counter:** Positive-Negative Counter for distributed counting
//! - **OR-Set:** Observed-Remove Set for add/remove operations (TODO)
//! - **Fractional Index:** Position-based list ordering (TODO)
//! - **Text CRDT:** Block-based text editing (TODO)
//!
//! # References
//!
//! - "A comprehensive study of CRDTs" by Marc Shapiro et al.
//! - "Conflict-free Replicated Data Types" (INRIA Research Report 7687)

pub mod pn_counter;
pub mod or_set;
// TODO: Phase 3 - Implement remaining CRDTs
// pub mod fractional_index;
// pub mod text;

pub use pn_counter::PNCounter;
pub use or_set::ORSet;
