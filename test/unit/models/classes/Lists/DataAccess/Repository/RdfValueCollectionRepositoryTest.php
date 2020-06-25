<?php

/**
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; under version 2
 * of the License (non-upgradable).
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 *
 * Copyright (c) 2020 (original work) Open Assessment Technologies SA;
 *
 * @author Sergei Mikhailov <sergei.mikhailov@taotesting.com>
 */

declare(strict_types=1);

namespace oat\tao\test\unit\model\Lists\DataAccess\Repository;

use common_persistence_sql_Platform as SqlPlatform;
use common_persistence_SqlPersistence as SqlPersistence;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Driver\ResultStatement;
use Doctrine\DBAL\Platforms\MySqlPlatform;
use Doctrine\DBAL\Query\Expression\ExpressionBuilder;
use oat\generis\model\OntologyRdf;
use oat\generis\model\OntologyRdfs;
use oat\generis\persistence\PersistenceManager;
use oat\generis\test\MockObject;
use oat\generis\test\TestCase;
use oat\tao\model\Lists\Business\Domain\Value;
use oat\tao\model\Lists\Business\Domain\ValueCollection;
use oat\tao\model\Lists\Business\Domain\ValueCollectionSearchRequest;
use oat\tao\model\Lists\DataAccess\Repository\RdfValueCollectionRepository;

class RdfValueCollectionRepositoryTest extends TestCase
{
    private const PERSISTENCE_ID = 'test';

    /** @var PersistenceManager|MockObject */
    private $persistenceManagerMock;

    /** @var SqlPersistence|MockObject */
    private $persistenceMock;

    /** @var Connection|MockObject */
    private $connectionMock;

    /** @var MySqlPlatform|MockObject */
    private $platformMock;

    /** @var RdfValueCollectionRepository */
    private $sut;

    /** @var array */
    private $queryParameters = [];

    /** @var int[] */
    private $queryParameterTypes = [];

    /**
     * @before
     */
    public function init(): void
    {
        $this->platformMock           = $this->createPartialMock(MySqlPlatform::class, []);
        $this->connectionMock         = $this->createPartialMock(
            Connection::class,
            ['getDatabasePlatform', 'getExpressionBuilder', 'executeQuery']
        );
        $this->persistenceMock        = $this->createMock(SqlPersistence::class);
        $this->persistenceManagerMock = $this->createMock(PersistenceManager::class);

        $this->setUpInitialMockExpectations();

        $this->sut = new RdfValueCollectionRepository($this->persistenceManagerMock, self::PERSISTENCE_ID);
    }

    /**
     * @param ValueCollectionSearchRequest $searchRequest
     *
     * @dataProvider dataProvider
     */
    public function testFindAll(ValueCollectionSearchRequest $searchRequest): void
    {
        $result = new ValueCollection(new Value('1', '1'), new Value('2', '2'));

        $this->expectQuery($searchRequest, $result);

        $this->assertEquals(
            $result,
            $this->sut->findAll($searchRequest)
        );
    }

    public function dataProvider(): array
    {
        return [
            'Bare search request'                     => [
                new ValueCollectionSearchRequest(),
            ],
            'Search request with property URI'        => [
                (new ValueCollectionSearchRequest())
                    ->setPropertyUri('https://example.com'),
            ],
            'Search request with subject'             => [
                (new ValueCollectionSearchRequest())
                    ->setPropertyUri('https://example.com')
                    ->setSubject('test'),
            ],
            'Search request with excluded value URIs' => [
                (new ValueCollectionSearchRequest())
                    ->setPropertyUri('https://example.com')
                    ->addExcluded('https://example.com#1')
                    ->addExcluded('https://example.com#2'),
            ],
            'Search request with limit'               => [
                (new ValueCollectionSearchRequest())
                    ->setPropertyUri('https://example.com')
                    ->setLimit(1),
            ],
            'Search request with all properties'      => [
                (new ValueCollectionSearchRequest())
                    ->setPropertyUri('https://example.com')
                    ->setSubject('test')
                    ->addExcluded('https://example.com#1')
                    ->addExcluded('https://example.com#2')
                    ->setLimit(1),
            ],
        ];
    }

    private function setUpInitialMockExpectations(): void
    {
        $this->persistenceManagerMock
            ->expects(static::atLeastOnce())
            ->method('getPersistenceById')
            ->with(self::PERSISTENCE_ID)
            ->willReturn($this->persistenceMock);

        $this->persistenceMock
            ->expects(static::atLeastOnce())
            ->method('getPlatform')
            ->willReturn(new SqlPlatform($this->connectionMock));

        $this->connectionMock
            ->method('getDatabasePlatform')
            ->willReturn($this->platformMock);

        $this->connectionMock
            ->method('getExpressionBuilder')
            ->willReturn(new ExpressionBuilder($this->connectionMock));
    }

    private function createQuery(ValueCollectionSearchRequest $searchRequest): string
    {
        $queryParts = [
            $this->createInitialQuery(),
            $this->createPropertyUriCondition($searchRequest),
            $this->createSubjectCondition($searchRequest),
            $this->createExcludedCondition($searchRequest),
        ];

        $queryParts[] = $this->createLimit($searchRequest);

        return implode(' ', array_filter($queryParts));
    }

    private function createInitialQuery(): string
    {
        return implode(
            ' ',
            [
                'SELECT element.subject, element.object',
                'FROM statements element',
            ]
        );
    }

    private function createPropertyUriCondition(ValueCollectionSearchRequest $searchRequest): ?string
    {
        if (!$searchRequest->hasPropertyUri()) {
            return null;
        }

        $this->queryParameters = [
            'property_uri' => $searchRequest->getPropertyUri(),
            'range_uri'    => OntologyRdfs::RDFS_RANGE,
            'label_uri'    => OntologyRdfs::RDFS_LABEL,
            'type_uri'     => OntologyRdf::RDF_TYPE,
        ];

        return implode(
            ' ',
            [
                'INNER JOIN statements collection',
                'ON collection.subject = element.subject',
                'INNER JOIN statements property',
                'ON property.object = collection.object',
                'WHERE (property.subject = :property_uri)',
                'AND (property.predicate = :range_uri)',
                'AND (element.predicate = :label_uri)',
                'AND (collection.predicate = :type_uri)',
            ]
        );
    }

    private function createSubjectCondition(ValueCollectionSearchRequest $searchRequest): ?string
    {
        if (!$searchRequest->hasSubject()) {
            return null;
        }

        $this->queryParameters['subject'] = "{$searchRequest->getSubject()}%";

        return 'AND (element.object LIKE :subject)';
    }

    private function createExcludedCondition(ValueCollectionSearchRequest $searchRequest): ?string
    {
        if (!$searchRequest->hasExcluded()) {
            return null;
        }

        $this->queryParameters['excluded_value_uri']     = $searchRequest->getExcluded();
        $this->queryParameterTypes['excluded_value_uri'] = Connection::PARAM_STR_ARRAY;

        return 'AND (element.subject NOT IN (:excluded_value_uri))';
    }

    private function createLimit(ValueCollectionSearchRequest $searchRequest): ?string
    {
        if (!$searchRequest->hasLimit()) {
            return null;
        }

        return "LIMIT {$searchRequest->getLimit()}";
    }

    private function expectQuery(ValueCollectionSearchRequest $searchRequest, ValueCollection $result): void
    {
        $statementMock = $this->createMock(ResultStatement::class);

        $statementMock
            ->expects(static::once())
            ->method('fetchAll')
            ->willReturn(
                $this->domainToRawData($result)
            );

        $this->connectionMock
            ->expects(static::once())
            ->method('executeQuery')
            ->with(
                $this->createQuery($searchRequest),
                $this->queryParameters,
                $this->queryParameterTypes,
                null
            )
            ->willReturn($statementMock);
    }

    private function domainToRawData(ValueCollection $valueCollection): array
    {
        $result = [];

        foreach ($valueCollection as $value) {
            $result[] = ['subject' => $value->getUri(), 'object' => $value->getLabel()];
        }

        return $result;
    }
}
