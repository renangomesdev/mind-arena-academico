package com.mindarena.repository;
import com.mindarena.model.ResourceQuota;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
public interface ResourceQuotaRepository extends JpaRepository<ResourceQuota, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select q from ResourceQuota q where q.id = :id")
    Optional<ResourceQuota> lock(@Param("id") String id);
}

