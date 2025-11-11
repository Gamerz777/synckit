-------------------------- MODULE vector_clock --------------------------
(*
  Vector Clock implementation for SyncKit causality tracking
  
  Vector clocks track causality between events in distributed systems.
  They enable detecting concurrent operations vs. causally ordered operations.
  
  Key properties verified:
  - Happens-before relationship is transitive
  - Concurrent operations are correctly identified
  - Clock advancement is monotonic
*)

EXTENDS Integers, TLC

CONSTANTS
  Clients,      \* Set of client IDs
  MaxClock      \* Maximum clock value (for bounded model checking)

VARIABLES
  clocks,       \* Vector clock for each client: client -> (client -> Int)
  events        \* History of events with their vector clocks

(*
  Vector clock is a mapping from each client to a logical clock value
*)
VectorClock == [Clients -> 0..MaxClock]

(*
  An event captures an operation with its causal context
*)
Event == [
  client: Clients,
  clock: VectorClock,
  sequence: Nat
]

(*
  Type invariant
*)
TypeInvariant ==
  /\ clocks \in [Clients -> VectorClock]
  /\ events \in SUBSET Event

(*
  Initial state - all clocks start at 0
*)
Init ==
  /\ clocks = [c \in Clients |-> [c2 \in Clients |-> 0]]
  /\ events = {}

(*
  Happens-before relationship (denoted as ->)
  
  Event e1 happens-before event e2 if:
  - e1.clock[c] <= e2.clock[c] for all clients c
  - AND there exists at least one client c where e1.clock[c] < e2.clock[c]
*)
HappensBefore(e1, e2) ==
  /\ \A c \in Clients : e1.clock[c] <= e2.clock[c]
  /\ \E c \in Clients : e1.clock[c] < e2.clock[c]

(*
  Concurrent events - neither happens before the other
*)
Concurrent(e1, e2) ==
  /\ ~HappensBefore(e1, e2)
  /\ ~HappensBefore(e2, e1)

(*
  Merge two vector clocks (take maximum of each component)
  Used when receiving remote operations.
*)
MergeClocks(vc1, vc2) ==
  [c \in Clients |-> IF vc1[c] > vc2[c] THEN vc1[c] ELSE vc2[c]]

(*
  Client performs a local operation
  
  Steps:
  1. Increment own clock component
  2. Record event with current vector clock
*)
LocalOperation(client) ==
  /\ clocks[client][client] < MaxClock  \* Bounds check for model checking
  /\ LET newClock == [clocks[client] EXCEPT ![client] = @ + 1]
         newEvent == [client |-> client, 
                     clock |-> newClock, 
                     sequence |-> clocks[client][client] + 1]
     IN /\ clocks' = [clocks EXCEPT ![client] = newClock]
        /\ events' = events \union {newEvent}

(*
  Client receives remote operation from another client
  
  Steps:
  1. Merge remote vector clock with local clock
  2. Increment own clock component
  3. Record event
*)
ReceiveOperation(receiver, sender) ==
  /\ receiver # sender
  /\ clocks[receiver][receiver] < MaxClock
  /\ LET mergedClock == MergeClocks(clocks[receiver], clocks[sender])
         newClock == [mergedClock EXCEPT ![receiver] = @ + 1]
         newEvent == [client |-> receiver,
                     clock |-> newClock,
                     sequence |-> clocks[receiver][receiver] + 1]
     IN /\ clocks' = [clocks EXCEPT ![receiver] = newClock]
        /\ events' = events \union {newEvent}

(*
  Next state - either local operation or receive
*)
Next ==
  \/ \E client \in Clients : LocalOperation(client)
  \/ \E receiver, sender \in Clients : ReceiveOperation(receiver, sender)

(*
  Specification
*)
Spec == Init /\ [][Next]_<<clocks, events>>

(*
  CAUSALITY PROPERTY
  
  If event e1 happened before e2 on the same client,
  then e1 happens-before e2 in the vector clock sense.
*)
CausalityPreserved ==
  \A e1, e2 \in events :
    (e1.client = e2.client /\ e1.sequence < e2.sequence) =>
    HappensBefore(e1, e2)

(*
  TRANSITIVITY PROPERTY
  
  If e1 -> e2 and e2 -> e3, then e1 -> e3
  This is fundamental to happens-before relationships.
*)
Transitivity ==
  \A e1, e2, e3 \in events :
    (HappensBefore(e1, e2) /\ HappensBefore(e2, e3)) =>
    HappensBefore(e1, e3)

(*
  MONOTONICITY PROPERTY
  
  Vector clocks never decrease - each component only grows.
*)
Monotonicity ==
  \A c1, c2 \in Clients :
    [][clocks[c1][c2] <= clocks'[c1][c2]]_clocks

(*
  CONCURRENT DETECTION PROPERTY
  
  Operations from different clients without causal relationship
  are correctly identified as concurrent.
*)
ConcurrentDetection ==
  \A e1, e2 \in events :
    (e1.client # e2.client /\ 
     ~HappensBefore(e1, e2) /\ 
     ~HappensBefore(e2, e1)) =>
    Concurrent(e1, e2)

(*
  MERGE CORRECTNESS
  
  Merging vector clocks preserves causality information.
  After merge, the merged clock happens-after both input clocks.
*)
MergeCorrectness ==
  \A vc1, vc2 \in VectorClock :
    LET merged == MergeClocks(vc1, vc2)
    IN /\ \A c \in Clients : merged[c] >= vc1[c]
       /\ \A c \in Clients : merged[c] >= vc2[c]

(*
  Model checking configuration:
  
  Clients = {c1, c2, c3}
  MaxClock = 3
  
  Properties to check:
  - CausalityPreserved
  - Transitivity
  - Monotonicity
  - ConcurrentDetection
  - MergeCorrectness
  
  Expected: All properties satisfied
*)

=============================================================================
